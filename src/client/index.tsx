/** Client half: writing pad controls plus user-message display projections. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import writingPadRemote from '../remote.ts'
import { BlankDetailsLayoutBridge } from './BlankDetailsLayoutBridge.tsx'
import { loadDefaultRewriteNote } from './preferences.ts'
import { createWritingPadStore, type WritingPadStore } from './store.ts'
import { WritingPad, type WritingPadBridge } from './WritingPad.tsx'
import { WritingRequestMessage } from './WritingRequestMessage.tsx'
import { WritingToggle } from './WritingToggle.tsx'
import { en, NS, zh } from './locales.ts'

export const inject = ['slots', 'layout', 'remote', 'locale']

async function unwrap<T>(call: Promise<RemoteResult<T>>): Promise<T> {
  const result = await call
  if (result.ok) return result.value
  throw new Error(result.error.message)
}

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'writing-pad: dictionaries')
  const tPad = ctx.locale.bind(NS)
  const disposeRemote = await ctx.remote.$mount(writingPadRemote)
  const store: WritingPadStore = createWritingPadStore(loadDefaultRewriteNote())
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
            resolveReview: (sessionId, reviewId, decision) => unwrap(
              ns.resolveReview(sessionId, reviewId, decision),
            ),
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
  const ensureOpen = (): void => ctx.layout.openDetails()

  ctx.slots.inject('details', () => ctx.slots.register(
    // ui-conversation owns priority 0. A lower rank intentionally shadows
    // its DetailsPanel while the writing-pad bundle is installed.
    { name: 'details', priority: -10, locale: NS },
    (props) => <WritingPad store={store} bridge={bridge} onClose={close} {...props} />,
  ))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    // ui-layout mounts details for blank sessions but forces its grid track to
    // zero. The bridge restores that real track instead of duplicating the pad
    // as a floating overlay, then withdraws after the first prompt.
    {
      name: 'shell.overlay',
      id: 'writing-pad-blank-layout',
      order: 30,
    },
    (props) => <BlankDetailsLayoutBridge store={store} {...props} />,
  ))
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
    // The input-left seat is the composer's one-row tool area. Keeping this
    // control here makes the writing surface available where requests begin.
    { name: 'conversation.input.left', id: 'writing-pad-toggle', order: 30, locale: NS },
    (props) => <WritingToggle store={store} onToggle={toggle} onEnsureOpen={ensureOpen} {...props} />,
  ))
  for (const key of ['user', 'steering'] as const) {
    ctx.slots.inject('conversation.chat.node', () => ctx.slots.register(
      // The shipped renderer remains at priority 0. This projection preserves
      // ordinary user rows while replacing writing-request XML with its human
      // selection/instruction summary.
      { name: 'conversation.chat.node', key, priority: -10, locale: 'conversation' },
      (props) => <WritingRequestMessage {...props} tPad={tPad} />,
    ))
  }

  return disposeRemote
}
