/** Client half of dsh-writing-pad: the two slot contributions. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import writingPadRemote from '../remote.ts'
import { createWritingPadStore, type WritingPadStore } from './store.ts'
import { WritingPad, type WritingPadBridge } from './WritingPad.tsx'
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
  const bridge: WritingPadBridge = {
    saveDraft: (sessionId, text) => unwrap(ctx.remote.writingPad.saveDraft(sessionId, text)),
    loadDraft: (sessionId) => unwrap(ctx.remote.writingPad.loadDraft(sessionId)),
    saveFile: (sessionId, name, text) => unwrap(ctx.remote.writingPad.saveFile(sessionId, name, text)),
    loadFile: (sessionId, name) => unwrap(ctx.remote.writingPad.loadFile(sessionId, name)),
  }
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
    { name: 'details' },
    (props) => <WritingPad store={store} bridge={bridge} onClose={close} {...props} />,
  ))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'writing-pad-toggle', order: 30 },
    (props) => <WritingToggle store={store} onToggle={toggle} {...props} />,
  ))

  return disposeRemote
}
