/** Own durable draft recovery and draft-context attachment to human messages. */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ContentBlock, UserMessage } from '@deepseek-ai/dsh-llm/types'
import type {} from '@deepseek-ai/dsh-tools/types'
import {
  parseDraftSnapshot,
  parseDraftContextMessage,
  parseWritingRequest,
  parseWritingPadMessageDraft,
  serializeDraftContextMessage,
} from './draft-xml.ts'
import {
  LEGACY_WRITING_DRAFT_TOOL,
  REWRITE_SELECTED_TEXT_TOOL,
  WRITE_FULL_DRAFT_TOOL,
} from './writing-tools.ts'

export const WRITING_PAD_PLUGIN = 'dsh-writing-pad'
export const REVIEW_PENDING_RESULT = '修改待用户确认。'

export interface DraftReview {
  id: string
  before: string
  after: string
}

export interface DerivedDraftState {
  draft: string
  review: DraftReview | null
}

/**
 * Attach the current complete draft to ordinary human messages before a step is logged.
 *
 * @param messages - Messages admitted to the proposed model step.
 * @param draft - Current writing-pad text, including Markdown bytes.
 * @returns The original array when no message needs wrapping, otherwise a rewritten copy.
 */
export function injectDraftIntoUserMessages(
  messages: UserMessage[],
  draft: string,
): UserMessage[] {
  if (draft.trim() === '') return messages
  let changed = false
  const rewritten = messages.map((message): UserMessage => {
    if (message.source.kind !== 'user') return message
    const conversationText = message.content
      .flatMap(block => block.type === 'text' ? [block.text] : [])
      .join('')
    if (parseWritingRequest(conversationText) !== null || parseDraftContextMessage(conversationText) !== null) {
      return message
    }

    const hasConversationText = message.content.some(block => block.type === 'text')
    const context = serializeDraftContextMessage(draft, '')
    const content: ContentBlock[] = [
      { type: 'text', text: hasConversationText ? `${context}\n\n` : context },
      ...message.content,
    ]
    changed = true
    return { ...message, content }
  })
  return changed ? rewritten : messages
}

type DraftArguments = Record<string, unknown>

function asRecord(value: unknown): DraftArguments | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as DraftArguments
    : null
}

function parseArguments(value: string): DraftArguments | null {
  try {
    return asRecord(JSON.parse(value))
  } catch {
    return null
  }
}

function normalizeWritingToolArguments(name: string, args: DraftArguments): DraftArguments | null {
  if (name === LEGACY_WRITING_DRAFT_TOOL) return args
  if (name === WRITE_FULL_DRAFT_TOOL) return { ...args, action: 'write' }
  if (name === REWRITE_SELECTED_TEXT_TOOL) return { ...args, action: 'rewrite' }
  return null
}

function locateInDraft(draft: string, oldText: string): { start: number; end: number } | null {
  const needle = oldText.trim()
  if (needle.length === 0) return null
  const idx = draft.indexOf(needle)
  if (idx !== -1) return { start: idx, end: idx + needle.length }
  const draftNorm = draft.replace(/\s+/g, ' ')
  const needleNorm = needle.replace(/\s+/g, ' ')
  const n = draftNorm.indexOf(needleNorm)
  if (n === -1) return null
  const map: number[] = []
  let pending = -1
  for (let i = 0; i < draft.length; i++) {
    const c = draft[i]
    if (/\s/.test(c)) {
      if (pending === -1) pending = i
      continue
    }
    if (pending !== -1) {
      map.push(pending)
      pending = -1
    }
    map.push(i)
  }
  const len = needleNorm.length
  if (n + len > map.length) return null
  return { start: map[n]!, end: map[n + len - 1]! + 1 }
}

/** Replace one exact (or whitespace-equivalent) source span in a draft. */
export function rewriteDraft(
  draft: string,
  oldText: string,
  newText: string,
): { matched: boolean; draft: string } {
  const location = locateInDraft(draft, oldText)
  if (location === null) return { matched: false, draft }
  return {
    matched: true,
    draft: draft.slice(0, location.start) + newText + draft.slice(location.end),
  }
}

/** Apply one normalized successful writing-tool call to a reconstructed draft. */
export function applyWritingDraftOperation(draft: string, args: DraftArguments): string {
  if (args.action === 'write' && typeof args.content === 'string') return args.content
  if (args.action !== 'rewrite' || typeof args.new !== 'string') return draft
  const oldText = typeof args.old === 'string' ? args.old.trim() : ''
  // Compatibility with 0.1.x, where an empty old represented a full write.
  if (oldText === '') return args.new
  return rewriteDraft(draft, oldText, args.new).draft
}

export function createDraftReview(before: string, after: string): DraftReview {
  const source = before + '\0' + after
  let left = 0x811c9dc5
  let right = 0x9e3779b9
  for (let index = 0; index < source.length; index++) {
    const code = source.charCodeAt(index)
    left = Math.imul(left ^ code, 0x01000193)
    right = Math.imul(right ^ code, 0x85ebca6b)
  }
  const id = [left, right]
    .map(value => (value >>> 0).toString(16).padStart(8, '0'))
    .join('') + '-' + source.length.toString(36)
  return { id, before, after }
}

function messageText(event: Extract<SessionEvent, { type: 'user/message' }>): string[] {
  return event.data.content.flatMap(block => block.type === 'text' ? [block.text] : [])
}

function resultText(content: readonly ContentBlock[]): string {
  return content.flatMap(block => block.type === 'text' && typeof block.text === 'string' ? [block.text] : []).join('\n')
}

function isSemanticFailure(isError: boolean, content: readonly ContentBlock[]): boolean {
  if (isError) return true
  const text = resultText(content).trimStart()
  return text.startsWith('错误：') || text.startsWith('Error:')
}

function isReviewResult(content: readonly ContentBlock[]): boolean {
  return resultText(content).includes(REVIEW_PENDING_RESULT)
}

/**
 * Fold the durable session log into the latest draft. User requests provide
 * full snapshots; only successful native or Code Mode writing-tool outcomes
 * apply later full-document writes or selection rewrites.
 */
export function deriveDraftStateFromSession(events: readonly SessionEvent[]): DerivedDraftState {
  let draft = ''
  let review: DraftReview | null = null
  const pending = new Map<string, DraftArguments>()

  const applyOperation = (args: DraftArguments, staged: boolean): void => {
    if (!staged) {
      draft = applyWritingDraftOperation(draft, args)
      review = null
      return
    }
    const before = review?.before ?? draft
    const working = review?.after ?? draft
    const after = applyWritingDraftOperation(working, args)
    review = after === before ? null : createDraftReview(before, after)
  }

  for (const event of events) {
    if (event.type === 'user/message') {
      const source = event.data.source
      for (const text of messageText(event)) {
        const requestDraft = source.kind === 'user' ? parseWritingPadMessageDraft(text) : null
        const legacyDraft = source.kind === 'plugin' && source.plugin === WRITING_PAD_PLUGIN
          ? parseDraftSnapshot(text)
          : null
        if (requestDraft !== null) {
          draft = requestDraft
          review = null
        } else if (legacyDraft !== null) {
          draft = legacyDraft
          review = null
        }
      }
      continue
    }
    if (event.type === 'tool/call') {
      const args = parseArguments(event.data.arguments)
      const operation = args === null ? null : normalizeWritingToolArguments(event.data.name, args)
      if (operation !== null) pending.set(event.data.callId, operation)
      continue
    }
    if (event.type === 'tool/result') {
      const source = event.data.message.source
      if (source.kind !== 'tool') continue
      const args = pending.get(source.callId)
      pending.delete(source.callId)
      if (args === undefined) continue
      const block = event.data.message.content[0]
      if (!isSemanticFailure(block.isError === true, block.content)) {
        applyOperation(args, isReviewResult(block.content))
      }
      continue
    }
    if (event.type === 'tool/code-dispatch') {
      const args = asRecord(event.data.arguments)
      const operation = args === null ? null : normalizeWritingToolArguments(event.data.name, args)
      if (operation !== null && !isSemanticFailure(event.data.isError, event.data.content)) {
        applyOperation(operation, isReviewResult(event.data.content))
      }
    }
  }
  return { draft, review }
}

export function deriveDraftFromSession(events: readonly SessionEvent[]): string {
  return deriveDraftStateFromSession(events).draft
}
