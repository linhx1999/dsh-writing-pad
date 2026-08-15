/** Composer tool-row action that opens and closes the writing pad column. */

import { useEffect, useSyncExternalStore } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { WritingPadStore } from './store.ts'

export type WritingToggleProps = PropsRuntime<'conversation.input.left'> & {
  store: WritingPadStore
  onToggle(sessionId: string): void
  onEnsureOpen(): void
}

const WRITING_PAD_ICON = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
    <path d="M3.5 2.5h6l3 3v8h-9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M9.5 2.5v3h3M5.5 8h5M5.5 10.5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function WritingToggle(props: WritingToggleProps) {
  const entry = useSyncExternalStore(
    props.store.subscribe,
    () => props.store.entryOf(props.sessionId),
  )
  const open = entry.open
  useEffect(() => {
    if (open) props.onEnsureOpen()
  }, [open, props.onEnsureOpen])
  const label = open ? '收起写作板' : '打开写作板'
  return (
    <button
      type="button"
      className={'dsw-writing-toggle' + (open ? ' is-active' : '')}
      title={label}
      aria-label={label}
      aria-pressed={open}
      onClick={() => props.onToggle(props.sessionId)}
    >
      {WRITING_PAD_ICON}
      <span className="dsw-writing-toggle-label">写作板</span>
    </button>
  )
}
