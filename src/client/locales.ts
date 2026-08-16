/** Writing-pad browser dictionaries and locale-aware feedback formatting. */

import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'

export const NS = 'writingPad'

export const zh = {
  'title.pad': '写作板',
  'toggle.open': '打开写作板',
  'toggle.close': '收起写作板',
  'toggle.label': '写作板',
  'mode.edit': '编辑',
  'mode.preview': '预览',
  'editor.placeholder': '在这里开始写作… 支持 Markdown 纯文本。',
  'note.defaultInstruction': '保持原意，改善表达，使文字更清晰流畅。',
  'aria.close': '关闭写作板',
  'aria.resizeTools': '调整底部功能区高度',
  'aria.resizeNote': '调整额外要求输入区高度',
  'hint.selected': '已选中：{text}',
  'hint.reviewPending': '请先确认或拒绝本次 AI 修改',
  'hint.emptyDraft': '先输入或粘贴正文，再选择要修改的内容',
  'hint.selectText': '请选择要修改的文字',
  'review.reject': '拒绝修改',
  'review.accept': '接受修改',
  'defaultNote.set': '设为默认',
  'defaultNote.clear': '清除默认',
  'action.send': '发送',
  'action.busy': '处理中…',
  'action.copy': '复制',
  'action.undo': '撤销',
  'action.clear': '清空',
  'foot.count': '{chars} 字 · {words} 词',
  'feedback.reviewFailed': '审核失败',
  'feedback.rawError': '{message}',
  'feedback.acceptedAutomatic': '已默认接受 AI 修改',
  'feedback.accepted': '已接受 AI 修改',
  'feedback.rejected': '已拒绝 AI 修改',
  'feedback.acceptedAutomaticPersistFailed': '已默认接受 AI 修改；审核记录未能持久保存',
  'feedback.acceptedPersistFailed': '已接受 AI 修改；审核记录未能持久保存',
  'feedback.rejectedPersistFailed': '已拒绝 AI 修改；审核记录未能持久保存',
  'feedback.reviewFailedDetail': '审核失败：{message}',
  'feedback.reviewReady': 'AI 已生成，请审核修改',
  'feedback.saving': '暂存中…',
  'feedback.saved': '已暂存',
  'feedback.saveFailed': '暂存失败：{message}',
  'feedback.closeSaveFailed': '关闭前暂存失败：{message}',
  'feedback.selectRequired': '请先在正文中选择要修改的内容',
  'feedback.sendUnsupported': '当前会话不支持发送写作请求',
  'feedback.requestSent': '改写请求已发送',
  'feedback.requestFailed': '请求发送失败：{message}',
  'feedback.undone': '已撤销上一次修改',
  'feedback.undoSaveFailed': '撤销已在本地生效，但暂存失败：{message}',
  'feedback.cleared': '草稿已清空，可点击撤销恢复',
  'feedback.clearSaveFailed': '草稿已在本地清空，但暂存失败：{message}',
  'feedback.copiedDraft': '已复制全部草稿',
  'feedback.copyFailed': '复制失败：{message}',
  'feedback.defaultRequired': '请先输入要保存的默认要求',
  'feedback.defaultSaveFailed': '默认要求保存失败',
  'feedback.defaultSaved': '已设为默认要求',
  'feedback.defaultClearFailed': '默认要求清除失败',
  'feedback.defaultCleared': '已清除默认要求',
  'feedback.unknownError': '未知错误',
  'message.selectionLabel': '修改内容',
  'message.instructionLabel': '额外要求',
  'message.copied': '已复制',
  'message.copy': '复制',
} satisfies Record<string, string>

export type WritingPadKey = keyof typeof zh
export type WritingPadFeedbackKey = Extract<WritingPadKey, `feedback.${string}`>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Writing-pad controls, status feedback, and transcript projections. */
    writingPad: WritingPadKey
  }
}

export const en = {
  'title.pad': 'Writing Pad',
  'toggle.open': 'Open Writing Pad',
  'toggle.close': 'Collapse Writing Pad',
  'toggle.label': 'Writing Pad',
  'mode.edit': 'Edit',
  'mode.preview': 'Preview',
  'editor.placeholder': 'Start writing here… Plain-text Markdown is supported.',
  'note.defaultInstruction': 'Preserve the original meaning while making the writing clearer and more fluent.',
  'aria.close': 'Close Writing Pad',
  'aria.resizeTools': 'Resize the bottom tools area',
  'aria.resizeNote': 'Resize the additional-instructions area',
  'hint.selected': 'Selected: {text}',
  'hint.reviewPending': 'Accept or reject the current AI changes first',
  'hint.emptyDraft': 'Enter or paste a draft, then select the passage to revise',
  'hint.selectText': 'Select the passage to revise',
  'review.reject': 'Reject changes',
  'review.accept': 'Accept changes',
  'defaultNote.set': 'Set as default',
  'defaultNote.clear': 'Clear default',
  'action.send': 'Send',
  'action.busy': 'Processing…',
  'action.copy': 'Copy',
  'action.undo': 'Undo',
  'action.clear': 'Clear',
  'foot.count': '{chars} characters · {words} words',
  'feedback.reviewFailed': 'Review failed',
  'feedback.rawError': '{message}',
  'feedback.acceptedAutomatic': 'AI changes accepted automatically',
  'feedback.accepted': 'AI changes accepted',
  'feedback.rejected': 'AI changes rejected',
  'feedback.acceptedAutomaticPersistFailed': 'AI changes were accepted automatically, but the review decision could not be saved',
  'feedback.acceptedPersistFailed': 'AI changes were accepted, but the review decision could not be saved',
  'feedback.rejectedPersistFailed': 'AI changes were rejected, but the review decision could not be saved',
  'feedback.reviewFailedDetail': 'Review failed: {message}',
  'feedback.reviewReady': 'AI changes are ready for review',
  'feedback.saving': 'Saving…',
  'feedback.saved': 'Saved',
  'feedback.saveFailed': 'Save failed: {message}',
  'feedback.closeSaveFailed': 'Could not save before closing: {message}',
  'feedback.selectRequired': 'Select the passage to revise first',
  'feedback.sendUnsupported': 'This conversation cannot send writing requests',
  'feedback.requestSent': 'Rewrite request sent',
  'feedback.requestFailed': 'Could not send the request: {message}',
  'feedback.undone': 'Last change undone',
  'feedback.undoSaveFailed': 'The change was undone locally, but could not be saved: {message}',
  'feedback.cleared': 'Draft cleared; use Undo to restore it',
  'feedback.clearSaveFailed': 'The draft was cleared locally, but could not be saved: {message}',
  'feedback.copiedDraft': 'Entire draft copied',
  'feedback.copyFailed': 'Copy failed: {message}',
  'feedback.defaultRequired': 'Enter a requirement before saving it as the default',
  'feedback.defaultSaveFailed': 'Could not save the default requirement',
  'feedback.defaultSaved': 'Default requirement saved',
  'feedback.defaultClearFailed': 'Could not clear the default requirement',
  'feedback.defaultCleared': 'Default requirement cleared',
  'feedback.unknownError': 'Unknown error',
  'message.selectionLabel': 'Selected passage',
  'message.instructionLabel': 'Additional instructions',
  'message.copied': 'Copied',
  'message.copy': 'Copy',
} satisfies Record<WritingPadKey, string>

export interface LocalizedFeedback {
  key: WritingPadFeedbackKey
  message?: string
}

/** Render semantic feedback with the active dictionary and a localized unknown-error fallback. */
export function formatFeedback(
  t: TranslateNS<typeof NS>,
  feedback: LocalizedFeedback,
): string {
  return t(feedback.key, {
    message: feedback.message ?? t('feedback.unknownError'),
  })
}

/** Resolve an empty rewrite note through the active locale without changing user-authored text. */
export function resolveRewriteInstruction(
  note: string,
  t: TranslateNS<typeof NS>,
): string {
  const trimmed = note.trim()
  return trimmed === '' ? t('note.defaultInstruction') : trimmed
}
