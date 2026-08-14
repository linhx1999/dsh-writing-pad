/**
 * Host half of dsh-writing-pad: the writingPad Remote service (draft and
 * workspace-file operations for the client) and the writing_draft agent tool.
 *
 * The service is a TypertRemoteService; `./remote` and `./typert` carry the
 * matching wire contribution (see README, "Client→Host bridge").
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

/** Minimal structural type for the optional `fs` service; the real contract lives in @deepseek-ai/dsh-fs. */
interface FsLike {
  resolve(path: string, opts?: { cwd?: string }): Promise<unknown>
  readText(target: unknown): Promise<string>
  writeText(target: unknown, content: string): Promise<unknown>
}

/** Process-local per-session draft buffers; a workspace file write is the durable form. */
const drafts = new Map<string, string>()

const DEFAULT_KEY = '__default__'

function keyOf(sessionId: string | undefined): string {
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : DEFAULT_KEY
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function validName(name: string): boolean {
  if (name.length === 0 || name.length > 200) return false
  if (name.startsWith('/') || name.includes('\\')) return false
  return name.split('/').every((s) => s.length > 0 && s !== '.' && s !== '..')
}

function locateInDraft(draft: string, oldText: string): { start: number; end: number } | null {
  const needle = oldText.trim()
  if (needle.length === 0) return null
  const idx = draft.indexOf(needle)
  if (idx !== -1) return { start: idx, end: idx + needle.length }
  const draftNorm = draft.replace(/\s+/g, ' ')
  const needleNorm = needle.replace(/\s+/g, ' ')
  const n = draftNorm.indexOf(needleNorm)
  if (n === -1) return null
  const map: number[] = []
  let pending = -1
  for (let i = 0; i < draft.length; i++) {
    const c = draft[i]
    if (/\s/.test(c)) {
      if (pending === -1) pending = i
      continue
    }
    if (pending !== -1) {
      map.push(pending)
      pending = -1
    }
    map.push(i)
  }
  const len = needleNorm.length
  if (n + len > map.length) return null
  return { start: map[n]!, end: map[n + len - 1]! + 1 }
}

type RemoteInitializer = (this: WritingPadService) => void
const remoteInitializers: RemoteInitializer[] = []

/** Host API for the writing pad client, mounted into `ctx.remote.writingPad`. */
export class WritingPadService extends TypertRemoteService {
  static inject = ['agents', 'tools']

  private readonly cwd: string | undefined

  constructor(ctx: Context) {
    super(ctx, 'writingPad')
    // The published dependency exposes standard (stage-3) decorators, while
    // this standalone tsdown build intentionally avoids a separate tsc emit
    // pass. Run the decorator initializers registered below explicitly so the
    // output is ordinary JavaScript on every supported Node release.
    for (const initialize of remoteInitializers) initialize.call(this)
    const sandboxPolicy = ctx.get('sandboxPolicy')
    this.cwd = sandboxPolicy !== undefined && typeof sandboxPolicy.workspaceRoot === 'string'
      ? sandboxPolicy.workspaceRoot
      : undefined
    ctx.effect(() => ctx.tools.register(this.toolDefinition()))
  }

  async saveDraft(agent: Agent, text: string): Promise<{ saved: boolean }> {
    drafts.set(keyOf(agent.session.id), text)
    return { saved: true }
  }

  async loadDraft(agent: Agent): Promise<{ text: string }> {
    return { text: drafts.get(keyOf(agent.session.id)) ?? '' }
  }

  async saveFile(
    agent: Agent,
    name: string,
    text: string,
  ): Promise<{ ok: boolean; error?: string; path?: string }> {
    const fs = this.ctx.get('fs') as FsLike | undefined
    if (fs === undefined) return { ok: false, error: 'filesystem unavailable' }
    const fileName = name.trim() || 'draft.md'
    if (!validName(fileName)) return { ok: false, error: 'file name must be a relative path without ".." or "\\"' }
    try {
      const target = await fs.resolve(fileName, { cwd: this.cwd })
      await fs.writeText(target, text)
      drafts.set(keyOf(agent.session.id), text)
      return { ok: true, path: fileName }
    } catch (err) {
      return { ok: false, error: errorMessage(err) }
    }
  }

  async loadFile(
    agent: Agent,
    name: string,
  ): Promise<{ ok: boolean; error?: string; path?: string; text?: string }> {
    const fs = this.ctx.get('fs') as FsLike | undefined
    if (fs === undefined) return { ok: false, error: 'filesystem unavailable' }
    const fileName = name.trim() || 'draft.md'
    if (!validName(fileName)) return { ok: false, error: 'file name must be a relative path without ".." or "\\"' }
    try {
      const target = await fs.resolve(fileName, { cwd: this.cwd })
      const text = await fs.readText(target)
      drafts.set(keyOf(agent.session.id), text)
      return { ok: true, path: fileName, text }
    } catch (err) {
      return { ok: false, error: errorMessage(err) }
    }
  }

  /** The writing_draft tool the agent calls in-session to read and rewrite the draft. */
  private toolDefinition() {
    return defineTool({
      name: 'writing_draft',
      description:
        '读写当前会话写作板的草稿。先调用 action=read 获取草稿全文；需要修改某部分时调用 action=rewrite，' +
        '其中 old 必须与草稿中的原文逐字一致（含 Markdown 标记，建议从 read 的结果中复制），new 是要替换的新内容。',
      parameters: {
        action: { type: 'string', enum: ['read', 'rewrite'], required: true, description: '操作类型' },
        old: { type: 'string', description: 'rewrite 时必填：草稿中要替换的原文片段，必须逐字一致' },
        new: { type: 'string', description: 'rewrite 时必填：替换后的新内容' },
      },
      output: {
        schema: {
          type: 'object',
          properties: { ok: { type: 'boolean' }, error: { type: 'string' }, draft: { type: 'string' } },
          additionalProperties: true,
        },
        render(_args, value) {
          const v: Record<string, unknown> = value !== null && typeof value === 'object'
            ? value as Record<string, unknown>
            : {}
          const lines: string[] = []
          if (typeof v.draft === 'string' && v.draft.length > 0) lines.push(v.draft)
          if (typeof v.error === 'string' && v.error.length > 0) lines.push('错误：' + v.error)
          if (lines.length === 0) lines.push('(无内容)')
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      async execute(args, exec) {
        const a = args
        const sessionId = exec.agent?.session.id
        const key = keyOf(sessionId)
        if (a.action === 'read') {
          return { ok: true, error: '', draft: drafts.get(key) ?? '' }
        }
        if (a.action === 'rewrite') {
          const oldText = typeof a.old === 'string' ? a.old.trim() : ''
          const newText = typeof a.new === 'string' ? a.new : ''
          if (oldText.length === 0) return { ok: false, error: '缺少 old 参数', draft: '' }
          const draft = drafts.get(key) ?? ''
          const loc = locateInDraft(draft, oldText)
          if (loc === null) {
            return {
              ok: false,
              error: '草稿中找不到与 old 逐字一致的原文片段（old 必须与草稿完全一致，含 Markdown 标记）',
              draft,
            }
          }
          drafts.set(key, draft.slice(0, loc.start) + newText + draft.slice(loc.end))
          return { ok: true, error: '', draft: drafts.get(key) ?? '' }
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

type RemoteMethodName = 'saveDraft' | 'loadDraft' | 'saveFile' | 'loadFile'

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

for (const name of ['saveDraft', 'loadDraft', 'saveFile', 'loadFile'] as const) {
  registerRemoteMarker(name)
}

export default WritingPadService
