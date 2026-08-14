/** Header action that opens and closes the writing pad column. */

import { useEffect, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { WritingPadStore } from './store.ts'

export type WritingToggleProps = PropsRuntime<'conversation.session.header.actions'> & {
  store: WritingPadStore
  onToggle(sessionId: string): void
}

export function WritingToggle(props: WritingToggleProps) {
  const [entry, setEntry] = useState(() => props.store.entryOf(props.sessionId))
  useEffect(() => props.store.subscribe(() => setEntry(props.store.entryOf(props.sessionId))), [props.store, props.sessionId])
  const open = entry.open
  return (
    <button
      type="button"
      className={'dsw-writing-toggle' + (open ? ' is-active' : '')}
      title="写作板"
      onClick={() => props.onToggle(props.sessionId)}
    >
      {open ? '收起写作板' : '写作板'}
    </button>
  )
}
