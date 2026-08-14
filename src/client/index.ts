/** Client half of dsh-writing-pad: the two slot contributions. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { WritingPadRemote } from '../remote.ts'
import { createWritingPadStore, type WritingPadStore } from './store.ts'
import { WritingPad, type WritingPadBridge } from './WritingPad.tsx'
import { WritingToggle } from './WritingToggle.tsx'

export const inject = ['slots', 'timer', 'layout', 'remote', 'remote.writingPad']

export function apply(ctx: ClientContext) {
  const store: WritingPadStore = createWritingPadStore()
  const remote = ctx.remote.writingPad as unknown as WritingPadRemote
  const bridge: WritingPadBridge = {
    saveDraft: (sessionId, text) => remote.saveDraft(sessionId, text),
    loadDraft: (sessionId) => remote.loadDraft(sessionId),
    saveFile: (sessionId, name, text) => remote.saveFile(sessionId, name, text),
    loadFile: (sessionId, name) => remote.loadFile(sessionId, name),
  }
  const schedule = (cb: () => void, ms: number): (() => void) => ctx.interval(cb, ms)
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
    (props) => <WritingPad store={store} bridge={bridge} schedule={schedule} onClose={close} {...props} />,
  ))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'writing-pad-toggle', order: 30 },
    (props) => <WritingToggle store={store} onToggle={toggle} {...props} />,
  ))
}
