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
  const editBurst = useRef(false)

  useEffect(() => {
    editBurst.current = false
    return () => {
      const pending = saveTimer.current !== null
      if (saveTimer.current !== null) clearTimeout(saveTimer.current)
      saveTimer.current = null
      if (pending) {
        const text = store.entryOf(sid).draft
        bridge.saveDraft(sid, text).then(() => {
          if (store.entryOf(sid).draft === text) store.setEntry(sid, { status: 'saved' })
        }).catch(() => {
          if (store.entryOf(sid).draft === text) store.setEntry(sid, { status: 'error' })
        })
      }
    }
  }, [sid, store, bridge])

  // Host memory is the typing fast path. After a restart, loadDraft folds the
  // latest user-request snapshot and successful writing_draft results.
  useEffect(() => {
    if (store.entryOf(sid).draft !== '') return
    bridge.loadDraft(sid).then((res) => {
      if (res.text !== '') store.replaceDraft(sid, res.text, { patch: { status: 'saved' } })
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
        store.replaceDraft(sid, res.text, {
          remember: true,
          patch: {
            notice: '已接收模型写回的最新草稿',
            previewSel: '',
            selStart: 0,
            selEnd: 0,
            status: 'saved',
          },
        })
      }).catch(() => {})
    }, 2000)
    return () => clearInterval(timer)
  }, [sid, store, bridge])

  const cancelPendingSave = (): void => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    saveTimer.current = null
    editBurst.current = false
  }

  const handleDraftChange = (text: string): void => {
    if (text === store.entryOf(sid).draft) return
    store.replaceDraft(sid, text, {
      remember: !editBurst.current,
      patch: { status: 'saving' },
    })
    editBurst.current = true
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      editBurst.current = false
      bridge.saveDraft(sid, text)
        .then(() => {
          if (store.entryOf(sid).draft === text) store.setEntry(sid, { status: 'saved' })
        })
        .catch(() => {
          if (store.entryOf(sid).draft === text) store.setEntry(sid, { status: 'error' })
        })
    }, 800)
  }

  const handleClose = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      cancelPendingSave()
      await bridge.saveDraft(sid, store.entryOf(sid).draft)
      store.setEntry(sid, { status: 'saved' })
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
    const selection = selectedText()
    if (selection === undefined) {
      store.setEntry(sid, { notice: '请先在正文中选择要修改的内容' })
      return
    }
    const inputActions = props.inputActions
    if (inputActions === undefined) {
      store.setEntry(sid, { notice: '当前会话不支持发送写作请求' })
      return
    }
    const note = entry.rewriteNote.trim()
    const instruction = note === '' ? '保持原意，改善表达，使文字更清晰流畅。' : note

    setBusy(true)
    try {
      cancelPendingSave()
      const draft = store.entryOf(sid).draft
      await bridge.saveDraft(sid, draft)
      // This is the one real user message for the turn. Carrying the complete
      // draft here keeps it model-visible and durable without inserting a
      // user/message between assistant(tool_calls) and tool/result.
      inputActions.setDraft(serializeWritingRequest({ operation: 'rewrite', draft, instruction, selection }))
      inputActions.submit()
      store.setEntry(sid, {
        notice: '改写请求已发送；模型会通过 writing_draft 把修改结果写回此处',
        previewSel: '',
        rewriteNote: '',
        status: 'saved',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      store.setEntry(sid, { notice: `请求发送失败：${message}`, status: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleUndo = async (): Promise<void> => {
    if (busy || entry.undoStack.length === 0) return
    setBusy(true)
    cancelPendingSave()
    const previous = store.undoDraft(sid, {
      previewSel: '',
      selStart: 0,
      selEnd: 0,
      status: 'saving',
    })
    if (previous === undefined) {
      setBusy(false)
      return
    }
    try {
      await bridge.saveDraft(sid, previous)
      store.setEntry(sid, { notice: '已撤销上一次修改', status: 'saved' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      store.setEntry(sid, { notice: `撤销已在本地生效，但暂存失败：${message}`, status: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    if (busy || entry.draft === '') return
    setBusy(true)
    cancelPendingSave()
    store.replaceDraft(sid, '', {
      remember: true,
      patch: {
        previewSel: '',
        selStart: 0,
        selEnd: 0,
        status: 'saving',
      },
    })
    try {
      await bridge.saveDraft(sid, '')
      store.setEntry(sid, { notice: '草稿已清空，可点击撤销恢复', status: 'saved' })
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      store.setEntry(sid, { notice: `草稿已在本地清空，但暂存失败：${message}`, status: 'error' })
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
      ? '先输入或粘贴正文，再选择要修改的内容'
      : '请选择要修改的文字'

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
          <button type="button" className="dsw-writing-pad-ai-btn" disabled={busy || !isRewrite} onClick={() => void handleWritingRequest()}>
            {busy ? '处理中…' : '发送改写请求'}
          </button>
        </div>
        <div className="dsw-writing-pad-note">
          <input
            className="dsw-writing-pad-note-input"
            value={entry.rewriteNote}
            placeholder="输入额外要求；留空则优化表达"
            spellCheck={false}
            onChange={(event) => store.setEntry(sid, { rewriteNote: event.target.value })}
          />
        </div>
        <div className="dsw-writing-pad-notice">{entry.notice}</div>
        <div className="dsw-writing-pad-foot">
          <span>{chars} 字 · {words} 词</span>
          <div className="dsw-writing-pad-foot-actions">
            <button type="button" className="dsw-writing-pad-undo" disabled={busy || entry.undoStack.length === 0} onClick={() => void handleUndo()}>撤销</button>
            <button type="button" className="dsw-writing-pad-clear" disabled={busy || entry.draft === ''} onClick={() => void handleClear()}>清空</button>
          </div>
        </div>
      </div>
    </div>
  )
}
