/** Session-backed Markdown writing pad and its structured AI request flow. */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { serializeWritingRequest, type WritingSelection } from '../draft-xml.ts'
import { renderMarkdown } from './markdown.ts'
import type { WritingPadStore } from './store.ts'
import './writing-pad.css'

export interface WritingPadBridge {
  saveDraft(sessionId: string, text: string): Promise<{ saved: boolean }>
  loadDraft(sessionId: string): Promise<{ text: string }>
}

export type WritingPadProps = PropsRuntime<'details'> & {
  store: WritingPadStore
  bridge: WritingPadBridge
  onClose(sessionId: string): void
}

const STATUS_TEXT: Record<string, string> = {
  idle: '',
  saving: '暂存中…',
  saved: '已暂存',
  error: '暂存失败',
}

export function WritingPad(props: WritingPadProps) {
  const { sessionId: sid, store, bridge, onClose } = props
  const [busy, setBusy] = useState(false)
  const entry = useSyncExternalStore(store.subscribe, () => store.entryOf(sid))
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
  }, [])

  // Host memory is the typing fast path. After a restart, loadDraft folds the
  // latest user-request snapshot and successful writing_draft results.
  useEffect(() => {
    if (store.entryOf(sid).draft !== '') return
    bridge.loadDraft(sid).then((res) => {
      if (res.text !== '') store.setEntry(sid, { draft: res.text, status: 'saved' })
    }).catch(() => {})
  }, [sid, store, bridge])

  // Agent-side writing_draft calls update Host memory. Polling keeps the pad
  // current without subscribing to the full conversation event stream.
  useEffect(() => {
    const timer = setInterval(() => {
      if (store.entryOf(sid).status === 'saving') return
      bridge.loadDraft(sid).then((res) => {
        const current = store.entryOf(sid)
        if (current.status === 'saving' || res.text === current.draft) return
        store.setEntry(sid, {
          draft: res.text,
          notice: '已自动同步模型写回的最新草稿',
          status: 'saved',
        })
      }).catch(() => {})
    }, 2000)
    return () => clearInterval(timer)
  }, [sid, store, bridge])

  const handleDraftChange = (text: string): void => {
    store.setEntry(sid, { draft: text, status: 'saving' })
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      bridge.saveDraft(sid, text)
        .then(() => store.setEntry(sid, { status: 'saved' }))
        .catch(() => store.setEntry(sid, { status: 'error' }))
    }, 800)
  }

  const handleClose = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await bridge.saveDraft(sid, store.entryOf(sid).draft)
      onClose(sid)
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      store.setEntry(sid, { notice: `关闭前暂存失败：${message}`, status: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const selectedText = (): WritingSelection | undefined => {
    if (entry.mode === 'preview') {
      return entry.previewSel.trim() === ''
        ? undefined
        : { mode: 'preview', text: entry.previewSel }
    }
    const start = entry.selStart
    const end = entry.selEnd
    const text = end > start ? entry.draft.slice(start, end) : ''
    return text.trim() === '' ? undefined : { mode: 'edit', start, end, text }
  }

  const handleWritingRequest = async (): Promise<void> => {
    if (busy) return
    const inputActions = props.inputActions
    if (inputActions === undefined) {
      store.setEntry(sid, { notice: '当前会话不支持发送写作请求' })
      return
    }
    const selection = selectedText()
    const operation = selection === undefined ? 'write' : 'rewrite'
    const note = entry.rewriteNote.trim()
    if (operation === 'write' && note === '') {
      store.setEntry(sid, { notice: '请输入要生成的内容；选中文字时则会改写该片段' })
      return
    }
    const instruction = note === '' ? '保持原意，改善表达，使文字更清晰流畅。' : note

    setBusy(true)
    try {
      const draft = store.entryOf(sid).draft
      await bridge.saveDraft(sid, draft)
      // This is the one real user message for the turn. Carrying the complete
      // draft here keeps it model-visible and durable without inserting a
      // user/message between assistant(tool_calls) and tool/result.
      inputActions.setDraft(serializeWritingRequest({ operation, draft, instruction, selection }))
      inputActions.submit()
      store.setEntry(sid, {
        notice: operation === 'write'
          ? '生成请求已发送；模型会通过 writing_draft 把完整结果写回此处'
          : '改写请求已发送；模型会通过 writing_draft 把修改结果写回此处',
        previewSel: '',
        rewriteNote: '',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      store.setEntry(sid, { notice: `请求发送失败：${message}`, status: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleSync = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const res = await bridge.loadDraft(sid)
      store.setEntry(sid, { draft: res.text, notice: '已同步当前会话草稿', status: 'saved' })
    } catch {
      store.setEntry(sid, { notice: '同步失败', status: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const trackSelection = (event: React.SyntheticEvent<HTMLTextAreaElement>): void => {
    store.setEntry(sid, {
      selStart: event.currentTarget.selectionStart,
      selEnd: event.currentTarget.selectionEnd,
    })
  }

  const capturePreviewSelection = (): void => {
    let selected = ''
    try {
      if (typeof window !== 'undefined' && typeof window.getSelection === 'function') {
        selected = window.getSelection()?.toString() ?? ''
      }
    } catch {
      selected = ''
    }
    store.setEntry(sid, { previewSel: selected })
  }

  const selection = selectedText()
  const isRewrite = selection !== undefined
  const chars = entry.draft.replace(/\s+/g, '').length
  const words = entry.draft.trim() === '' ? 0 : entry.draft.trim().split(/\s+/).length
  const hint = isRewrite
    ? `已选中：${selection.text.trim().slice(0, 16)}${selection.text.trim().length > 16 ? '…' : ''}`
    : entry.draft === ''
      ? '输入写作要求，模型会把完整结果直接写入此处'
      : '未选择文字：发送请求将重新生成并替换全文'

  return (
    <div className="dsw-writing-pad">
      <div className="dsw-writing-pad-head">
        <span className="dsw-writing-pad-title">写作板</span>
        <span className={'dsw-writing-pad-status ' + entry.status}>{STATUS_TEXT[entry.status] ?? ''}</span>
        <div className="dsw-writing-pad-modes">
          <button type="button" className={'dsw-writing-pad-mode' + (entry.mode === 'edit' ? ' is-active' : '')} onClick={() => store.setEntry(sid, { mode: 'edit' })}>编辑</button>
          <button type="button" className={'dsw-writing-pad-mode' + (entry.mode === 'preview' ? ' is-active' : '')} onClick={() => store.setEntry(sid, { mode: 'preview' })}>预览</button>
        </div>
        <button type="button" className="dsw-writing-pad-close" disabled={busy} onClick={() => void handleClose()}>✕</button>
      </div>
      {entry.mode === 'preview' ? (
        <div className="dsw-writing-pad-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.draft) }} onMouseUp={capturePreviewSelection} />
      ) : (
        <textarea
          className="dsw-writing-pad-area"
          value={entry.draft}
          placeholder="在这里开始写作… 支持 Markdown 纯文本。"
          autoFocus
          spellCheck={false}
          onChange={(event) => handleDraftChange(event.target.value)}
          onFocus={trackSelection}
          onSelect={trackSelection}
          onKeyUp={trackSelection}
        />
      )}
      <div className="dsw-writing-pad-tools">
        <div className="dsw-writing-pad-ai">
          <span className="dsw-writing-pad-ai-hint">{hint}</span>
          <button type="button" className="dsw-writing-pad-ai-btn" disabled={busy} onClick={() => void handleWritingRequest()}>
            {busy ? '处理中…' : isRewrite ? '发送改写请求' : '生成全文'}
          </button>
        </div>
        <div className="dsw-writing-pad-note">
          <input
            className="dsw-writing-pad-note-input"
            value={entry.rewriteNote}
            placeholder="输入生成要求；选中文字时作为改写要求"
            spellCheck={false}
            onChange={(event) => store.setEntry(sid, { rewriteNote: event.target.value })}
          />
        </div>
        <div className="dsw-writing-pad-checkpoint">
          <span className="dsw-writing-pad-checkpoint-hint">完整草稿会随下一条写作请求发送，不写入工作区文件</span>
          <button type="button" className="dsw-writing-pad-checkpoint-btn" disabled={busy} onClick={() => void handleSync()}>同步</button>
        </div>
        <div className="dsw-writing-pad-notice">{entry.notice}</div>
        <div className="dsw-writing-pad-foot">
          <span>{chars} 字 · {words} 词</span>
          <button type="button" className="dsw-writing-pad-clear" disabled={busy} onClick={() => handleDraftChange('')}>清空</button>
        </div>
      </div>
    </div>
  )
}
