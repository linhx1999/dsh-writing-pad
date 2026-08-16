/**
 * Host half of dsh-writing-pad: the session-backed writingPad Remote service
 * and the focused full-draft/selection-rewrite agent tools.
 *
 * The service is a TypertRemoteService; `./remote` and `./typert` carry the
 * matching wire contribution (see README, "Client→Host bridge").
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import {
  createDraftReview,
  deriveDraftStateFromSession,
  REVIEW_PENDING_RESULT,
  rewriteDraft,
  type DerivedDraftState,
} from './draft-session.ts'
import {
  REWRITE_SELECTED_TEXT_DESCRIPTION,
  REWRITE_SELECTED_TEXT_TOOL,
  WRITE_FULL_DRAFT_DESCRIPTION,
  WRITE_FULL_DRAFT_TOOL,
} from './writing-tools.ts'

/** Process-local buffers keep typing cheap between durable conversation events. */
const drafts = new Map<string, DerivedDraftState>()

const DEFAULT_KEY = '__default__'

function keyOf(sessionId: string | undefined): string {
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : DEFAULT_KEY
}

type RemoteInitializer = (this: WritingPadService) => void
const remoteInitializers: RemoteInitializer[] = []

function writingToolOutput() {
  return {
    schema: {
      type: 'object' as const,
      properties: {
        ok: { type: 'boolean' as const },
        error: { type: 'string' as const },
        draft: { type: 'string' as const },
      },
      additionalProperties: true,
    },
    render(_args: unknown, value: unknown) {
      const result: Record<string, unknown> = value !== null && typeof value === 'object'
        ? value as Record<string, unknown>
        : {}
      const lines: string[] = []
      if (typeof result.error === 'string' && result.error.length > 0) lines.push('错误：' + result.error)
      if (result.ok === true) lines.push(REVIEW_PENDING_RESULT)
      else if (typeof result.draft === 'string') lines.push(result.draft.length > 0 ? result.draft : '(草稿为空)')
      if (lines.length === 0) lines.push('(无内容)')
      return [{ type: 'text' as const, text: lines.join('\n') }]
    },
  }
}

/** Host API for the writing pad client, mounted into `ctx.remote.writingPad`. */
export class WritingPadService extends TypertRemoteService {
  static inject = ['agents', 'tools']

  constructor(ctx: Context) {
    super(ctx, 'writingPad')
    // The published dependency exposes standard (stage-3) decorators, while
    // this standalone tsdown build intentionally avoids a separate tsc emit
    // pass. Run the decorator initializers registered below explicitly so the
    // output is ordinary JavaScript on every supported Node release.
    for (const initialize of remoteInitializers) initialize.call(this)
    ctx.effect(() => ctx.tools.register(this.writeToolDefinition()))
    ctx.effect(() => ctx.tools.register(this.rewriteToolDefinition()))
  }

  async saveDraft(agent: Agent, text: string): Promise<{ saved: boolean }> {
    const current = this.stateOf(agent)
    drafts.set(keyOf(agent.session.id), {
      draft: text,
      review: current.review?.before === text ? current.review : null,
    })
    return { saved: true }
  }

  async loadDraft(agent: Agent): Promise<{ text: string; review: DerivedDraftState['review'] }> {
    const state = this.stateOf(agent)
    return { text: state.draft, review: state.review }
  }

  async resolveReview(
    agent: Agent,
    reviewId: string,
    decision: 'accept' | 'reject',
  ): Promise<{ ok: boolean; error: string; text: string }> {
    const state = this.stateOf(agent)
    if (state.review === null || state.review.id !== reviewId) {
      return { ok: false, error: '待确认修改已过期，请重新加载', text: state.draft }
    }
    const text = decision === 'accept' ? state.review.after : state.review.before
    drafts.set(keyOf(agent.session.id), { draft: text, review: null })
    return { ok: true, error: '', text }
  }

  private stateOf(agent: Agent): DerivedDraftState {
    const key = keyOf(agent.session.id)
    const buffered = drafts.get(key)
    if (buffered !== undefined) return buffered
    const restored = deriveDraftStateFromSession(agent.session.events)
    drafts.set(key, restored)
    return restored
  }

  private stageToolDraft(agent: Agent, text: string): { ok: boolean; error: string; draft: string } {
    // Do not append a user/message here. The harness must append tool/result
    // immediately after assistant(tool_calls); the successful call/result pair
    // itself is enough to reconstruct this update after a restart.
    const current = this.stateOf(agent)
    const before = current.review?.before ?? current.draft
    drafts.set(keyOf(agent.session.id), {
      draft: current.draft,
      review: text === before ? null : createDraftReview(before, text),
    })
    return { ok: true, error: '', draft: text }
  }

  /** Full-document writes and selection rewrites have separate model interfaces. */
  private writeToolDefinition() {
    return defineTool({
      name: WRITE_FULL_DRAFT_TOOL,
      description: WRITE_FULL_DRAFT_DESCRIPTION,
      parameters: {
        content: { type: 'string', required: true, description: '根据用户写作请求生成的、可直接使用的完整 Markdown 成稿' },
      },
      output: writingToolOutput(),
      execute: async (args, exec) => {
        const agent = exec.agent
        if (agent === undefined) return { ok: false, error: '当前没有可用会话', draft: '' }
        return this.stageToolDraft(agent, args.content)
      },
    })
  }

  private rewriteToolDefinition() {
    return defineTool({
      name: REWRITE_SELECTED_TEXT_TOOL,
      description: REWRITE_SELECTED_TEXT_DESCRIPTION,
      parameters: {
        old: { type: 'string', required: true, description: '选区对应的最小 Markdown 源码片段，必须与草稿源码一致，禁止传入全文' },
        new: { type: 'string', required: true, description: '仅用于替换 old 的局部内容，禁止传入全文' },
      },
      output: writingToolOutput(),
      execute: async (args, exec) => {
        const agent = exec.agent
        if (agent === undefined) return { ok: false, error: '当前没有可用会话', draft: '' }
        const oldText = args.old.trim()
        const state = this.stateOf(agent)
        const draft = state.review?.after ?? state.draft
        if (oldText.length === 0) {
          return { ok: false, error: 'old 必须是非空的局部原文片段', draft }
        }
        const rewritten = rewriteDraft(draft, oldText, args.new)
        if (!rewritten.matched) {
          return {
            ok: false,
            error: '草稿中找不到与 old 逐字一致的原文片段（old 必须与草稿完全一致，含 Markdown 标记）',
            draft,
          }
        }
        return this.stageToolDraft(agent, rewritten.draft)
      },
    })
  }
}

interface RemoteDecoratorContext {
  readonly name: string
  readonly static: false
  readonly private: false
  addInitializer(initializer: RemoteInitializer): void
}

type RemoteMethodName = 'saveDraft' | 'loadDraft' | 'resolveReview'

function registerRemoteMarker(name: RemoteMethodName): void {
  // Remote only consumes name/static/private/addInitializer at runtime. This
  // small adapter reproduces the standard decorator call without shipping
  // syntax that Node cannot parse yet.
  const decorate = Remote(name) as unknown as (
    method: unknown,
    context: RemoteDecoratorContext,
  ) => void
  decorate(WritingPadService.prototype[name], {
    name,
    static: false,
    private: false,
    addInitializer(initializer) {
      remoteInitializers.push(initializer)
    },
  })
}

for (const name of ['saveDraft', 'loadDraft', 'resolveReview'] as const) {
  registerRemoteMarker(name)
}

export default WritingPadService
