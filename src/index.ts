/**
 * Host half of dsh-writing-pad: the session-backed writingPad Remote service
 * and the writing_draft agent tool.
 *
 * The service is a TypertRemoteService; `./remote` and `./typert` carry the
 * matching wire contribution (see README, "Client→Host bridge").
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { deriveDraftFromSession, rewriteDraft } from './draft-session.ts'

/** Process-local buffers keep typing cheap between durable conversation events. */
const drafts = new Map<string, string>()

const DEFAULT_KEY = '__default__'

function keyOf(sessionId: string | undefined): string {
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : DEFAULT_KEY
}

type RemoteInitializer = (this: WritingPadService) => void
const remoteInitializers: RemoteInitializer[] = []

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
    ctx.effect(() => ctx.tools.register(this.toolDefinition()))
  }

  async saveDraft(agent: Agent, text: string): Promise<{ saved: boolean }> {
    drafts.set(keyOf(agent.session.id), text)
    return { saved: true }
  }

  async loadDraft(agent: Agent): Promise<{ text: string }> {
    return { text: this.draftOf(agent) }
  }

  private draftOf(agent: Agent): string {
    const key = keyOf(agent.session.id)
    const buffered = drafts.get(key)
    if (buffered !== undefined) return buffered
    const restored = deriveDraftFromSession(agent.session.events)
    drafts.set(key, restored)
    return restored
  }

  private commitToolDraft(agent: Agent, text: string): { ok: boolean; error: string; draft: string } {
    // Do not append a user/message here. The harness must append tool/result
    // immediately after assistant(tool_calls); the successful call/result pair
    // itself is enough to reconstruct this update after a restart.
    drafts.set(keyOf(agent.session.id), text)
    return { ok: true, error: '', draft: text }
  }

  /** The writing_draft tool is the model's explicit output destination. */
  private toolDefinition() {
    return defineTool({
      name: 'writing_draft',
      description:
        '当前会话写作板的唯一模型写入出口。收到 <dsh-writing-pad-request operation="write"> 时，生成完整写作结果并调用 ' +
        'action=write、content=完整正文；不要只在普通 assistant 回复中给出正文。收到 operation="rewrite" 时调用 action=rewrite，' +
        'old 必须与当前草稿中的原文逐字一致（含 Markdown 标记），new 是替换内容；preview 选区可能不含 Markdown 标记，' +
        '应先在当前草稿中定位对应源码再复制为 old。需要确认当前内容时调用 action=read。' +
        'write/rewrite 成功后正文会自动出现在写作板；本次工具调用及结果会记录该修改，随后只需简短确认。',
      parameters: {
        action: { type: 'string', enum: ['read', 'write', 'rewrite'], required: true, description: '操作类型' },
        content: { type: 'string', description: 'write 时必填：要放入写作板的完整 Markdown 正文' },
        old: { type: 'string', description: 'rewrite 时必填：草稿中要替换的原文片段，必须逐字一致' },
        new: { type: 'string', description: 'rewrite 时必填：替换后的新内容' },
      },
      output: {
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, error: { type: 'string' }, draft: { type: 'string' } },
          additionalProperties: true,
        },
        render(args, value) {
          const v: Record<string, unknown> = value !== null && typeof value === 'object'
            ? value as Record<string, unknown>
            : {}
          const lines: string[] = []
          const ok = v.ok === true
          if (typeof v.error === 'string' && v.error.length > 0) lines.push('错误：' + v.error)
          if ((args.action === 'read' || !ok) && typeof v.draft === 'string') {
            lines.push(v.draft.length > 0 ? v.draft : '(草稿为空)')
          } else if (ok) {
            lines.push('草稿已写入写作板。')
          }
          if (lines.length === 0) lines.push('(无内容)')
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      execute: async (args, exec) => {
        const a = args
        const agent = exec.agent
        if (agent === undefined) {
          return { ok: false, error: '当前没有可用会话', draft: '' }
        }
        if (a.action === 'read') {
          return { ok: true, error: '', draft: this.draftOf(agent) }
        }
        if (a.action === 'write') {
          if (typeof a.content !== 'string') {
            return { ok: false, error: 'write 缺少 content 参数', draft: this.draftOf(agent) }
          }
          return this.commitToolDraft(agent, a.content)
        }
        if (a.action === 'rewrite') {
          const oldText = typeof a.old === 'string' ? a.old.trim() : ''
          if (oldText.length === 0 || typeof a.new !== 'string') {
            return { ok: false, error: 'rewrite 缺少非空 old 或 new 参数', draft: this.draftOf(agent) }
          }
          const newText = a.new
          const draft = this.draftOf(agent)
          const rewritten = rewriteDraft(draft, oldText, newText)
          if (!rewritten.matched) {
            return {
              ok: false,
              error: '草稿中找不到与 old 逐字一致的原文片段（old 必须与草稿完全一致，含 Markdown 标记）',
              draft,
            }
          }
          return this.commitToolDraft(agent, rewritten.draft)
        }
        return { ok: false, error: '未知的 action: ' + String(a.action), draft: '' }
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

type RemoteMethodName = 'saveDraft' | 'loadDraft'

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

for (const name of ['saveDraft', 'loadDraft'] as const) {
  registerRemoteMarker(name)
}

export default WritingPadService
