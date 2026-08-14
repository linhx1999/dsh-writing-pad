/** Client half: writing pad controls plus user-message display projections. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import writingPadRemote from '../remote.ts'
import { createWritingPadStore, type WritingPadStore } from './store.ts'
import { WritingPad, type WritingPadBridge } from './WritingPad.tsx'
import { WritingRequestMessage } from './WritingRequestMessage.tsx'
import { WritingToggle } from './WritingToggle.tsx'

export const inject = ['slots', 'layout', 'remote']

async function unwrap<T>(call: Promise<RemoteResult<T>>): Promise<T> {
  const result = await call
  if (result.ok) return result.value
  throw new Error(result.error.message)
}

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(writingPadRemote)
  const store: WritingPadStore = createWritingPadStore()
  // The api-gateway installs each mounted Remote namespace as a Cordis service
  // named `remote.<namespace>`, and reading `ctx.remote.writingPad` requires
  // that qualified name in the caller fiber's `inject` (the framework's own
  // `remote.commands` pattern). A namespace mounted by this very module cannot
  // be injected at module level — the fiber would wait for a service it only
  // mounts inside apply, a boot deadlock. So the mount happens here, and the
  // bridge lives in a child fiber that injects the now-existing namespace.
  const bridge = await new Promise<WritingPadBridge>((resolve, reject) => {
    try {
      ctx.plugin({
        name: 'writing-pad-bridge',
        inject: ['remote.writingPad'],
        apply(cctx: ClientContext) {
          const ns = cctx.remote.writingPad
          resolve({
            saveDraft: (sessionId, text) => unwrap(ns.saveDraft(sessionId, text)),
            loadDraft: (sessionId) => unwrap(ns.loadDraft(sessionId)),
          })
        },
      }).then(() => undefined, (error: unknown) => reject(error))
    } catch (error) {
      reject(error)
    }
  })
  const toggle = (sid: string): void => {
    const open = store.entryOf(sid).open
    store.setEntry(sid, { open: !open })
    if (open) ctx.layout.closeDetails()
    else ctx.layout.openDetails()
  }
  const close = (sid: string): void => {
    store.setEntry(sid, { open: false })
    ctx.layout.closeDetails()
  }

  ctx.slots.inject('details', () => ctx.slots.register(
    // ui-conversation owns priority 0. A lower rank intentionally shadows
    // its DetailsPanel while the writing-pad bundle is installed.
    { name: 'details', priority: -10 },
    (props) => <WritingPad store={store} bridge={bridge} onClose={close} {...props} />,
  ))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'writing-pad-toggle', order: 30 },
    (props) => <WritingToggle store={store} onToggle={toggle} {...props} />,
  ))
  for (const key of ['user', 'steering'] as const) {
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
      // The shipped renderer remains at priority 0. This projection preserves
      // ordinary user rows while replacing writing-request XML with its human
      // selection/instruction summary.
      { name: 'conversation.chat.node', key, priority: -10, locale: 'conversation' },
      WritingRequestMessage,
    ))
  }

  return disposeRemote
}
