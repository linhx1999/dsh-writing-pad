/** Session-backed Markdown writing pad and its structured AI request flow. */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { serializeWritingRequest, type WritingSelection } from '../draft-xml.ts'
import { renderMarkdown, renderMarkdownDiff } from './markdown.ts'
import { resizePanelHeights, type PanelHeights } from './panel-resize.ts'
import {
  clearReviewDecision,
  loadReviewDecision,
  saveDefaultRewriteNote,
  saveReviewDecision,
  type ReviewDecision,
} from './preferences.ts'
import type { DraftReview, FeedbackTone, WritingPadStore } from './store.ts'
import './writing-pad.css'

export interface WritingPadBridge {
  saveDraft(sessionId: string, text: string): Promise<{ saved: boolean }>
  loadDraft(sessionId: string): Promise<{ text: string; review: DraftReview | null }>
  resolveReview(
    sessionId: string,
    reviewId: string,
    decision: ReviewDecision,
  ): Promise<{ ok: boolean; error: string; text: string }>
}

export type WritingPadProps = PropsRuntime<'details'> & {
  store: WritingPadStore
  bridge: WritingPadBridge
  onClose(sessionId: string): void
}

const DEFAULT_REWRITE_INSTRUCTION = '保持原意，改善表达，使文字更清晰流畅。'
const MIN_TOOLS_HEIGHT = 190
const MAX_TOOLS_HEIGHT = 420
const MIN_NOTE_HEIGHT = 54
const MAX_NOTE_HEIGHT = 284
const INITIAL_PANEL_HEIGHTS: PanelHeights = { tools: 190, note: 54 }

export function WritingPad(props: WritingPadProps) {
  const { sessionId: sid, store, bridge, onClose } = props
  const [busy, setBusy] = useState(false)
  const [panelHeights, setPanelHeights] = useState(INITIAL_PANEL_HEIGHTS)
  const { note: noteHeight, tools: toolsHeight } = panelHeights
  const entry = useSyncExternalStore(store.subscribe, () => store.entryOf(sid))
  const latestEntry = useRef(entry)
  latestEntry.current = entry
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackId = useRef(0)
  const resolvingReview = useRef<string | null>(null)
  const editBurst = useRef(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const panelResizeStart = useRef<{ y: number; heights: PanelHeights } | null>(null)

  const showFeedback = useCallback((text: string, tone: FeedbackTone, persistent = false): void => {
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current)
    const id = ++feedbackId.current
    store.setEntry(sid, { feedback: { id, text, tone, persistent } })
    if (!persistent) {
      feedbackTimer.current = setTimeout(() => {
        feedbackTimer.current = null
        if (store.entryOf(sid).feedback?.id === id) store.setEntry(sid, { feedback: null })
      }, 3000)
    }
  }, [sid, store])

  const applyReviewDecision = useCallback(async (
    decision: ReviewDecision,
    automatic = false,
  ): Promise<boolean> => {
    const review = store.entryOf(sid).review
    if (review === null) return true
    if (resolvingReview.current === review.id) return false
    resolvingReview.current = review.id
    setBusy(true)
    try {
      const result = await bridge.resolveReview(sid, review.id, decision)
      if (!result.ok) {
        showFeedback(result.error || '审核失败', 'error', true)
        return false
      }
      const persisted = saveReviewDecision(sid, { reviewId: review.id, decision })
      store.replaceDraft(sid, result.text, {
        remember: decision === 'accept',
        patch: {
          review: null,
          mode: 'preview',
          previewSel: '',
          selStart: 0,
          selEnd: 0,
          status: 'saved',
        },
      })
      latestEntry.current = store.entryOf(sid)
      const label = decision === 'accept'
        ? automatic ? '已默认接受 AI 修改' : '已接受 AI 修改'
        : '已拒绝 AI 修改'
      showFeedback(
        persisted ? label : `${label}；审核记录未能持久保存`,
        persisted ? decision === 'accept' ? 'success' : 'warning' : 'error',
        !persisted,
      )
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      showFeedback(`审核失败：${message}`, 'error', true)
      return false
    } finally {
      resolvingReview.current = null
      setBusy(false)
    }
  }, [bridge, showFeedback, sid, store])

  const reconcileLoaded = useCallback(async (res: { text: string; review: DraftReview | null }): Promise<void> => {
    if (res.review !== null) {
      const saved = loadReviewDecision(sid)
      if (saved?.reviewId === res.review.id) {
        if (resolvingReview.current === res.review.id) return
        store.setEntry(sid, { review: res.review })
        await applyReviewDecision(saved.decision, true)
        return
      }
      if (saved !== null) clearReviewDecision(sid)
      const current = store.entryOf(sid)
      if (current.review?.id === res.review.id) return
      if (current.draft !== res.text) store.replaceDraft(sid, res.text)
      store.setEntry(sid, { review: res.review, mode: 'preview', status: 'saved' })
      showFeedback('AI 已生成，请审核修改', 'generated', true)
      return
    }
    const current = store.entryOf(sid)
    if (current.status === 'saving' || (res.text === current.draft && current.review === null)) return
    store.replaceDraft(sid, res.text, {
      remember: true,
      patch: { review: null, previewSel: '', selStart: 0, selEnd: 0, status: 'saved' },
    })
  }, [applyReviewDecision, showFeedback, sid, store])

  useEffect(() => {
    editBurst.current = false
    return () => {
      const current = latestEntry.current
      if (current.review !== null) {
        saveReviewDecision(sid, { reviewId: current.review.id, decision: 'accept' })
        void bridge.resolveReview(sid, current.review.id, 'accept')
      }
      const pending = saveTimer.current !== null
      if (saveTimer.current !== null) clearTimeout(saveTimer.current)
      if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current)
      saveTimer.current = null
      feedbackTimer.current = null
      if (pending && current.review === null) void bridge.saveDraft(sid, current.draft)
    }
  }, [sid, bridge])

  useEffect(() => {
    void bridge.loadDraft(sid).then(reconcileLoaded).catch(() => {})
  }, [sid, bridge, reconcileLoaded])

  useEffect(() => {
    const timer = setInterval(() => {
      if (store.entryOf(sid).status === 'saving') return
      void bridge.loadDraft(sid).then(reconcileLoaded).catch(() => {})
    }, 2000)
    return () => clearInterval(timer)
  }, [sid, store, bridge, reconcileLoaded])

  const cancelPendingSave = (): void => {
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    saveTimer.current = null
    editBurst.current = false
  }

  const handleDraftChange = (text: string): void => {
    if (text === store.entryOf(sid).draft) return
    store.replaceDraft(sid, text, { remember: !editBurst.current, patch: { status: 'saving' } })
    showFeedback('暂存中…', 'info', true)
    editBurst.current = true
    if (saveTimer.current !== null) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      editBurst.current = false
      bridge.saveDraft(sid, text).then(() => {
        if (store.entryOf(sid).draft === text) {
          store.setEntry(sid, { status: 'saved' })
          showFeedback('已暂存', 'success')
        }
      }).catch((error: unknown) => {
        if (store.entryOf(sid).draft === text) {
          store.setEntry(sid, { status: 'error' })
          showFeedback(`暂存失败：${error instanceof Error ? error.message : '未知错误'}`, 'error', true)
        }
      })
    }, 800)
  }

  const handleClose = async (): Promise<void> => {
    if (busy) return
    if (entry.review !== null && !await applyReviewDecision('accept', true)) return
    setBusy(true)
    try {
      cancelPendingSave()
      await bridge.saveDraft(sid, store.entryOf(sid).draft)
      store.setEntry(sid, { status: 'saved' })
      onClose(sid)
    } catch (error) {
      showFeedback(`关闭前暂存失败：${error instanceof Error ? error.message : '未知错误'}`, 'error', true)
    } finally {
      setBusy(false)
    }
  }

  const selectedText = (): WritingSelection | undefined => {
    if (entry.mode === 'preview') {
      return entry.previewSel.trim() === '' ? undefined : { mode: 'preview', text: entry.previewSel }
    }
    const text = entry.selEnd > entry.selStart ? entry.draft.slice(entry.selStart, entry.selEnd) : ''
    return text.trim() === ''
      ? undefined
      : { mode: 'edit', start: entry.selStart, end: entry.selEnd, text }
  }

  const handleWritingRequest = async (): Promise<void> => {
    if (busy) return
    if (entry.review !== null && !await applyReviewDecision('accept', true)) return
    const selection = selectedText()
    if (selection === undefined) {
      showFeedback('请先在正文中选择要修改的内容', 'warning')
      return
    }
    if (props.inputActions === undefined) {
      showFeedback('当前会话不支持发送写作请求', 'error', true)
      return
    }
    const note = entry.rewriteNote.trim()
    const instruction = note === '' ? DEFAULT_REWRITE_INSTRUCTION : note
    setBusy(true)
    try {
      cancelPendingSave()
      const draft = store.entryOf(sid).draft
      await bridge.saveDraft(sid, draft)
      props.inputActions.setDraft(serializeWritingRequest({ operation: 'rewrite', draft, instruction, selection }))
      props.inputActions.submit()
      clearReviewDecision(sid)
      store.setEntry(sid, {
        previewSel: '',
        rewriteNote: store.defaultRewriteNote(),
        status: 'saved',
      })
      showFeedback('改写请求已发送', 'info')
    } catch (error) {
      showFeedback(`请求发送失败：${error instanceof Error ? error.message : '未知错误'}`, 'error', true)
    } finally {
      setBusy(false)
    }
  }

  const handleUndo = async (): Promise<void> => {
    if (busy || entry.undoStack.length === 0 || entry.review !== null) return
    setBusy(true)
    cancelPendingSave()
    const previous = store.undoDraft(sid, { previewSel: '', selStart: 0, selEnd: 0, status: 'saving' })
    if (previous === undefined) return setBusy(false)
    try {
      await bridge.saveDraft(sid, previous)
      store.setEntry(sid, { status: 'saved' })
      showFeedback('已撤销上一次修改', 'success')
    } catch (error) {
      showFeedback(`撤销已在本地生效，但暂存失败：${error instanceof Error ? error.message : '未知错误'}`, 'error', true)
    } finally {
      setBusy(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    if (busy || entry.draft === '' || entry.review !== null) return
    setBusy(true)
    cancelPendingSave()
    store.replaceDraft(sid, '', {
      remember: true,
      patch: { previewSel: '', selStart: 0, selEnd: 0, status: 'saving' },
    })
    try {
      await bridge.saveDraft(sid, '')
      store.setEntry(sid, { status: 'saved' })
      showFeedback('草稿已清空，可点击撤销恢复', 'warning')
    } catch (error) {
      showFeedback(`草稿已在本地清空，但暂存失败：${error instanceof Error ? error.message : '未知错误'}`, 'error', true)
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async (): Promise<void> => {
    if (busy || entry.draft === '') return
    try {
      await navigator.clipboard.writeText(entry.draft)
      showFeedback('已复制全部草稿', 'success')
    } catch (error) {
      showFeedback(`复制失败：${error instanceof Error ? error.message : '未知错误'}`, 'error', true)
    }
  }

  const focusNote = (): void => {
    requestAnimationFrame(() => noteRef.current?.focus({ preventScroll: true }))
  }

  const completeEditSelection = (element: HTMLTextAreaElement): void => {
    const selStart = element.selectionStart
    const selEnd = element.selectionEnd
    store.setEntry(sid, { selStart, selEnd })
    if (selEnd > selStart && element.value.slice(selStart, selEnd).trim() !== '') focusNote()
  }

  const capturePreviewSelection = (): void => {
    if (entry.review !== null) return
    let selected = ''
    try {
      selected = window.getSelection?.()?.toString() ?? ''
    } catch {}
    store.setEntry(sid, { previewSel: selected })
    if (selected.trim() !== '') focusNote()
  }

  const handleMode = async (mode: 'edit' | 'preview'): Promise<void> => {
    if (mode === 'edit' && entry.review !== null && !await applyReviewDecision('accept', true)) return
    store.setEntry(sid, { mode })
  }

  const handleSaveDefault = (): void => {
    const note = entry.rewriteNote.trim()
    if (note === '') return showFeedback('请先输入要保存的默认要求', 'warning')
    if (!saveDefaultRewriteNote(note)) return showFeedback('默认要求保存失败', 'error', true)
    store.setDefaultRewriteNote(note)
    store.setEntry(sid, { rewriteNote: note })
    showFeedback('已设为默认要求', 'success')
  }

  const handleClearDefault = (): void => {
    if (!saveDefaultRewriteNote('')) return showFeedback('默认要求清除失败', 'error', true)
    const currentNote = entry.rewriteNote
    store.setDefaultRewriteNote('')
    store.setEntry(sid, { rewriteNote: currentNote })
    showFeedback('已清除默认要求', 'success')
  }

  const panelHeightBounds = (): {
    minTools: number
    maxTools: number
    minNote: number
    maxNote: number
  } => {
    const padHeight = padRef.current?.clientHeight ?? 600
    return {
      minTools: MIN_TOOLS_HEIGHT,
      maxTools: Math.max(
        MIN_TOOLS_HEIGHT,
        Math.min(MAX_TOOLS_HEIGHT, Math.round(padHeight * 0.7)),
      ),
      minNote: MIN_NOTE_HEIGHT,
      maxNote: MAX_NOTE_HEIGHT,
    }
  }

  const beginPanelResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    panelResizeStart.current = { y: event.clientY, heights: panelHeights }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  const movePanelResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = panelResizeStart.current
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || start === null) return
    setPanelHeights(resizePanelHeights(
      start.heights,
      start.y - event.clientY,
      panelHeightBounds(),
    ))
  }

  const finishPanelResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    panelResizeStart.current = null
  }

  const handlePanelResizeKey = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const delta = event.key === 'ArrowUp' ? 10 : -10
    setPanelHeights(heights => resizePanelHeights(heights, delta, panelHeightBounds()))
  }

  const selection = selectedText()
  const isRewrite = selection !== undefined && entry.review === null
  const hasRewriteNote = entry.rewriteNote.trim() !== ''
  const chars = entry.draft.replace(/\s+/g, '').length
  const words = entry.draft.trim() === '' ? 0 : entry.draft.trim().split(/\s+/).length
  const hint = isRewrite
    ? `已选中：${selection.text.trim().slice(0, 16)}${selection.text.trim().length > 16 ? '…' : ''}`
    : entry.review !== null
      ? '请先确认或拒绝本次 AI 修改'
      : entry.draft === '' ? '先输入或粘贴正文，再选择要修改的内容' : '请选择要修改的文字'

  return (
    <div ref={padRef} className="dsw-writing-pad">
      <div className="dsw-writing-pad-head">
        <span className="dsw-writing-pad-title">写作板</span>
        <div className="dsw-writing-pad-modes">
          <button type="button" disabled={busy} className={'dsw-writing-pad-mode' + (entry.mode === 'edit' ? ' is-active' : '')} onClick={() => void handleMode('edit')}>编辑</button>
          <button type="button" disabled={busy} className={'dsw-writing-pad-mode' + (entry.mode === 'preview' ? ' is-active' : '')} onClick={() => void handleMode('preview')}>预览</button>
        </div>
        <button type="button" className="dsw-writing-pad-close" disabled={busy} onClick={() => void handleClose()}>✕</button>
      </div>

      {entry.review !== null ? (
        <div className="dsw-writing-pad-review">
          <div className="dsw-writing-pad-review-bar">
            <div className="dsw-writing-pad-diff-legend"><span className="is-add">新增</span><span className="is-delete">删除</span></div>
            <div className="dsw-writing-pad-review-actions">
              <button type="button" disabled={busy} className="dsw-writing-pad-review-reject" onClick={() => void applyReviewDecision('reject')}>拒绝修改</button>
              <button type="button" disabled={busy} className="dsw-writing-pad-review-accept" onClick={() => void applyReviewDecision('accept')}>接受修改</button>
            </div>
          </div>
          <div className="dsw-writing-pad-preview" dangerouslySetInnerHTML={{ __html: renderMarkdownDiff(entry.review.before, entry.review.after) }} />
        </div>
      ) : entry.mode === 'preview' ? (
        <div className="dsw-writing-pad-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.draft) }} onPointerUp={capturePreviewSelection} />
      ) : (
        <textarea
          className="dsw-writing-pad-area"
          value={entry.draft}
          placeholder="在这里开始写作… 支持 Markdown 纯文本。"
          autoFocus
          spellCheck={false}
          onChange={(event) => handleDraftChange(event.target.value)}
          onSelect={(event) => store.setEntry(sid, { selStart: event.currentTarget.selectionStart, selEnd: event.currentTarget.selectionEnd })}
          onPointerUp={(event) => completeEditSelection(event.currentTarget)}
          onKeyUp={(event) => store.setEntry(sid, { selStart: event.currentTarget.selectionStart, selEnd: event.currentTarget.selectionEnd })}
        />
      )}

      <div className="dsw-writing-pad-tools" style={{ height: toolsHeight }}>
        <div
          className="dsw-writing-pad-tools-resize"
          role="separator"
          aria-label="调整底部功能区高度"
          aria-orientation="horizontal"
          aria-valuemin={MIN_TOOLS_HEIGHT}
          aria-valuemax={MAX_TOOLS_HEIGHT}
          aria-valuenow={toolsHeight}
          tabIndex={0}
          onPointerDown={beginPanelResize}
          onPointerMove={movePanelResize}
          onPointerUp={finishPanelResize}
          onPointerCancel={finishPanelResize}
          onKeyDown={handlePanelResizeKey}
        />
        <div className="dsw-writing-pad-ai-hint">{hint}</div>
        <div className="dsw-writing-pad-note-editor" style={{ height: noteHeight }}>
          <div
            className="dsw-writing-pad-note-resize"
            role="separator"
            aria-label="调整额外要求输入区高度"
            aria-orientation="horizontal"
            aria-valuemin={MIN_NOTE_HEIGHT}
            aria-valuemax={MAX_NOTE_HEIGHT}
            aria-valuenow={noteHeight}
            tabIndex={0}
            onPointerDown={beginPanelResize}
            onPointerMove={movePanelResize}
            onPointerUp={finishPanelResize}
            onPointerCancel={finishPanelResize}
            onKeyDown={handlePanelResizeKey}
          />
          <textarea
            ref={noteRef}
            className="dsw-writing-pad-note-input"
            value={entry.rewriteNote}
            placeholder={store.defaultRewriteNote() || DEFAULT_REWRITE_INSTRUCTION}
            spellCheck={false}
            disabled={entry.review !== null}
            onChange={(event) => store.setEntry(sid, { rewriteNote: event.target.value })}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.stopPropagation()
              const composing = event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229
              if (composing || event.shiftKey) return
              event.preventDefault()
              if (!event.repeat) void handleWritingRequest()
            }}
            onKeyUp={(event) => {
              if (event.key === 'Enter') event.stopPropagation()
            }}
          />
          <button
            type="button"
            className={`dsw-writing-pad-ai-btn${hasRewriteNote ? '' : ' is-empty'}`}
            disabled={busy || !isRewrite}
            onClick={() => void handleWritingRequest()}
          >
            {busy ? '处理中…' : '发送'}
          </button>
        </div>
        <div className="dsw-writing-pad-meta-row">
          <div className="dsw-writing-pad-feedback-slot">
            {entry.feedback !== null && (
              <span
                className={`dsw-writing-pad-feedback is-${entry.feedback.tone}`}
                role={entry.feedback.tone === 'error' ? 'alert' : 'status'}
                aria-live={entry.feedback.tone === 'error' ? 'assertive' : 'polite'}
              >{entry.feedback.text}</span>
            )}
          </div>
          <div className="dsw-writing-pad-default-actions">
            <button type="button" disabled={busy || entry.rewriteNote.trim() === '' || entry.rewriteNote.trim() === store.defaultRewriteNote()} onClick={handleSaveDefault}>设为默认</button>
            {store.defaultRewriteNote() !== '' && <button type="button" disabled={busy} onClick={handleClearDefault}>清除默认</button>}
          </div>
        </div>
        <div className="dsw-writing-pad-foot">
          <span>{chars} 字 · {words} 词</span>
          <div className="dsw-writing-pad-foot-actions">
            <button type="button" className="dsw-writing-pad-copy" disabled={busy || entry.draft === ''} onClick={() => void handleCopy()}>复制</button>
            <button type="button" className="dsw-writing-pad-undo" disabled={busy || entry.undoStack.length === 0 || entry.review !== null} onClick={() => void handleUndo()}>撤销</button>
            <button type="button" className="dsw-writing-pad-clear" disabled={busy || entry.draft === '' || entry.review !== null} onClick={() => void handleClear()}>清空</button>
          </div>
        </div>
      </div>
    </div>
  )
}
