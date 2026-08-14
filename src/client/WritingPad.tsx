/** The writing pad: Markdown editor, preview, AI rewrite request, file ops. */

import { useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { renderMarkdown } from './markdown.ts'
import type { WritingPadStore } from './store.ts'
import './writing-pad.css'

export interface WritingPadBridge {
  saveDraft(sessionId: string, text: string): Promise<{ saved: boolean }>
  loadDraft(sessionId: string): Promise<{ text: string }>
  saveFile(sessionId: string, name: string, text: string): Promise<{ ok: boolean; error?: string; path?: string }>
  loadFile(sessionId: string, name: string): Promise<{ ok: boolean; error?: string; path?: string; text?: string }>
}

export type WritingPadProps = PropsRuntime<'details'> & {
  store: WritingPadStore
  bridge: WritingPadBridge
  onClose(sessionId: string): void
}

const STATUS_TEXT: Record<string, string> = { idle: '', saving: '保存中…', saved: '已保存', error: '保存失败' }

export function WritingPad(props: WritingPadProps) {
  const { sessionId: sid, store, bridge, onClose } = props
  const [entry, setEntry] = useState(() => store.entryOf(sid))
  useEffect(() => store.subscribe(() => setEntry(store.entryOf(sid))), [store, sid])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
  }, [])

  // Restore the session draft on first open (after a page refresh the host
  // memory is the source of truth).
  useEffect(() => {
    if (store.entryOf(sid).draft !== '') return
    bridge.loadDraft(sid).then((res) => {
      if (res.text) store.setEntry(sid, { draft: res.text })
    }).catch(() => {})
  }, [sid, store, bridge])

  // Poll the host draft so agent-side writing_draft rewrites appear
  // automatically. Skip while the user is typing (status saving).
  useEffect(() => {
    const timer = setInterval(() => {
      if (store.entryOf(sid).status === 'saving') return
      bridge.loadDraft(sid).then((res) => {
        const cur = store.entryOf(sid)
        if (cur.status === 'saving') return
        if (res.text !== cur.draft) {
          store.setEntry(sid, { draft: res.text, fileStatus: '已自动同步最新草稿', status: 'saved' })
        }
      }).catch(() => {})
    }, 2000)
    return () => clearInterval(timer)
  }, [sid, store, bridge])

  const handleDraftChange = (text: string): void => {
    store.setEntry(sid, { draft: text, status: 'saving' })
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      bridge.saveDraft(sid, text).then(() => store.setEntry(sid, { status: 'saved' }))
        .catch(() => store.setEntry(sid, { status: 'error' }))
    }, 800)
  }

  const handleSaveFile = (): void => {
    const name = store.entryOf(sid).fileName.trim() || 'draft.md'
    store.setEntry(sid, { fileStatus: '正在保存到文件…' })
    bridge.saveFile(sid, name, store.entryOf(sid).draft).then((res) => {
      if (res.ok) store.setEntry(sid, { fileName: res.path ?? name, fileStatus: `已保存到 ${res.path}`, status: 'saved' })
      else store.setEntry(sid, { fileStatus: `保存失败：${res.error ?? '未知错误'}` })
    }).catch(() => store.setEntry(sid, { fileStatus: '保存失败' }))
  }

  const handleLoadFile = (): void => {
    const name = store.entryOf(sid).fileName.trim() || 'draft.md'
    store.setEntry(sid, { fileStatus: '正在加载文件…' })
    bridge.loadFile(sid, name).then((res) => {
      if (res.ok && res.text !== undefined) {
        store.setEntry(sid, { draft: res.text, fileName: res.path ?? name, fileStatus: `已加载 ${res.path}`, status: 'saved' })
      } else {
        store.setEntry(sid, { fileStatus: `加载失败：${res.error ?? '未知错误'}` })
      }
    }).catch(() => store.setEntry(sid, { fileStatus: '加载失败' }))
  }

  const handleRewriteRequest = (): void => {
    const inputActions = props.inputActions
    let selection = ''
    if (entry.mode === 'preview') {
      selection = entry.previewSel.trim()
      if (selection.length === 0) {
        store.setEntry(sid, { fileStatus: '请先在预览中划选一段文字' })
        return
      }
    } else {
      const start = entry.selStart
      const end = entry.selEnd
      if (end <= start) {
        store.setEntry(sid, { fileStatus: '请先在写作区选中一段文字' })
        return
      }
      selection = entry.draft.slice(start, end).trim()
    }
    if (selection.length === 0) {
      store.setEntry(sid, { fileStatus: '选中的是空白内容' })
      return
    }
    if (inputActions === undefined) {
      store.setEntry(sid, { fileStatus: '当前会话不支持发送到对话' })
      return
    }
    const note = entry.rewriteNote.trim()
    let text = '请改写我在写作板中选中的这段文字，保持原意、改善表达。请先调用 writing_draft 工具（action=read）读取当前草稿，找到与这段文字对应的原文（含 Markdown 标记），改写后用 writing_draft 工具（action=rewrite，old=原文，new=改写结果）写回草稿。'
    if (note.length > 0) text += '\n改写要求：' + note
    text += '\n选中的文字：\n' + selection
    inputActions.setDraft(text)
    inputActions.submit()
    store.setEntry(sid, { fileStatus: '改写请求已发送到对话，完成后点「同步」拉取草稿', previewSel: '', rewriteNote: '' })
  }

  const trackSelection = (e: React.SyntheticEvent<HTMLTextAreaElement>): void => {
    store.setEntry(sid, { selStart: e.currentTarget.selectionStart, selEnd: e.currentTarget.selectionEnd })
  }

  const chars = entry.draft.replace(/\s+/g, '').length
  const words = entry.draft.trim() ? entry.draft.trim().split(/\s+/).length : 0
  let hint = '选中一段文字后，把改写请求发到对话，AI 会在会话中完成并写回草稿'
  if (entry.mode === 'preview') {
    const sel = entry.previewSel.trim()
    hint = sel.length > 0 ? `已选中：${sel.slice(0, 16)}${sel.length > 16 ? '…' : ''}` : '在预览中划选一段文字后，点按钮把改写请求发到对话'
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

  return (
    <div className="dsw-writing-pad">
      <div className="dsw-writing-pad-head">
        <span className="dsw-writing-pad-title">写作板</span>
        <span className={'dsw-writing-pad-status ' + (entry.status ?? '')}>{STATUS_TEXT[entry.status] ?? ''}</span>
        <div className="dsw-writing-pad-modes">
          <button type="button" className={'dsw-writing-pad-mode' + (entry.mode === 'edit' ? ' is-active' : '')} onClick={() => store.setEntry(sid, { mode: 'edit' })}>编辑</button>
          <button type="button" className={'dsw-writing-pad-mode' + (entry.mode === 'preview' ? ' is-active' : '')} onClick={() => store.setEntry(sid, { mode: 'preview' })}>预览</button>
        </div>
        <button type="button" className="dsw-writing-pad-close" onClick={() => onClose(sid)}>✕</button>
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
          onChange={(e) => handleDraftChange(e.target.value)}
          onFocus={trackSelection}
          onSelect={trackSelection}
          onKeyUp={trackSelection}
        />
      )}
      <div className="dsw-writing-pad-tools">
        <div className="dsw-writing-pad-ai">
          <span className="dsw-writing-pad-ai-hint">{hint}</span>
          <button type="button" className="dsw-writing-pad-ai-btn" onClick={handleRewriteRequest}>发送改写请求</button>
        </div>
        <div className="dsw-writing-pad-note">
          <input
            className="dsw-writing-pad-note-input"
            value={entry.rewriteNote}
            placeholder="补充改写要求（可选），如：更口语化、更简洁、语气正式些…"
            spellCheck={false}
            onChange={(e) => store.setEntry(sid, { rewriteNote: e.target.value })}
          />
        </div>
        <div className="dsw-writing-pad-file">
          <input
            className="dsw-writing-pad-file-input"
            value={entry.fileName}
            placeholder="draft.md（相对当前工作区）"
            spellCheck={false}
            onChange={(e) => store.setEntry(sid, { fileName: e.target.value })}
          />
          <button type="button" className="dsw-writing-pad-file-btn" onClick={handleSaveFile}>保存到文件</button>
          <button type="button" className="dsw-writing-pad-file-btn" onClick={handleLoadFile}>加载</button>
          <button type="button" className="dsw-writing-pad-file-btn" onClick={() => bridge.loadDraft(sid).then((res) => store.setEntry(sid, { draft: res.text, fileStatus: '已从草稿库同步', status: 'saved' })).catch(() => store.setEntry(sid, { fileStatus: '同步失败' }))}>同步</button>
        </div>
        <div className="dsw-writing-pad-file-status">{entry.fileStatus}</div>
        <div className="dsw-writing-pad-foot">
          <span>{chars} 字 · {words} 词</span>
          <button type="button" className="dsw-writing-pad-clear" onClick={() => handleDraftChange('')}>清空</button>
        </div>
      </div>
    </div>
  )
}
