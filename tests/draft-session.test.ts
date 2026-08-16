import assert from 'node:assert/strict'
import test from 'node:test'
import { CallId } from '@deepseek-ai/dsh-llm/brand'
import { createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm/message'
import type { SessionEvent, SessionEventMap, SessionEventType } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools/types'
import {
  applyWritingDraftOperation,
  createDraftReview,
  deriveDraftFromSession,
  deriveDraftStateFromSession,
  REVIEW_PENDING_RESULT,
  WRITING_PAD_PLUGIN,
} from '../src/draft-session.ts'
import { serializeDraftSnapshot, serializeWritingRequest } from '../src/draft-xml.ts'
import {
  LEGACY_WRITING_DRAFT_TOOL,
  REWRITE_SELECTED_TEXT_TOOL,
  WRITE_FULL_DRAFT_TOOL,
} from '../src/writing-tools.ts'

function event<T extends SessionEventType>(
  seq: number,
  type: T,
  data: SessionEventMap[T],
): SessionEvent<T> {
  return { seq, time: seq, type, data } as SessionEvent<T>
}

function request(seq: number, draft: string): SessionEvent<'user/message'> {
  return event(seq, 'user/message', createUserMessage({
    content: [{ type: 'text', text: serializeWritingRequest({
      operation: 'write',
      draft,
      instruction: '续写',
    }) }],
    source: { kind: 'user' },
  }))
}

function call(
  seq: number,
  callId: string,
  args: Record<string, unknown>,
  name = LEGACY_WRITING_DRAFT_TOOL,
): SessionEvent<'tool/call'> {
  return event(seq, 'tool/call', {
    turn: 1,
    step: 1,
    callId: CallId(callId),
    name,
    arguments: JSON.stringify(args),
  })
}

function result(
  seq: number,
  callId: string,
  text: string,
  isError = false,
): SessionEvent<'tool/result'> {
  return event(seq, 'tool/result', {
    turn: 1,
    step: 1,
    message: createToolResultMessage({
      callId: CallId(callId),
      content: [{ type: 'text', text }],
      isError,
    }),
  })
}

test('a real user request carries the complete draft snapshot', () => {
  const events = [request(1, '# 初稿\n\n正文')]
  assert.equal(deriveDraftFromSession(events), '# 初稿\n\n正文')
  assert.equal(events.filter(item => item.type === 'user/message').length, 1)
})

test('a successful native tool result applies without an intervening user message', () => {
  const events: SessionEvent[] = [
    request(1, '旧稿'),
    call(2, 'write-1', { content: '模型生成的新稿' }, WRITE_FULL_DRAFT_TOOL),
    result(3, 'write-1', '草稿已写入写作板。'),
  ]

  assert.deepEqual(events.map(item => item.type), ['user/message', 'tool/call', 'tool/result'])
  assert.equal(deriveDraftFromSession(events), '模型生成的新稿')
})

test('new tool results stage a deterministic review without replacing the accepted draft', () => {
  const events: SessionEvent[] = [
    request(1, '旧稿'),
    call(2, 'rewrite-review', { old: '旧稿', new: '候选新稿' }, REWRITE_SELECTED_TEXT_TOOL),
    result(3, 'rewrite-review', REVIEW_PENDING_RESULT),
  ]

  const state = deriveDraftStateFromSession(events)
  assert.equal(state.draft, '旧稿')
  assert.deepEqual(state.review, createDraftReview('旧稿', '候选新稿'))
  assert.equal(deriveDraftFromSession(events), '旧稿')
})

test('consecutive review operations build one candidate from the accepted base', () => {
  const events: SessionEvent[] = [
    request(1, '甲乙丙'),
    call(2, 'review-1', { action: 'rewrite', old: '甲', new: 'A' }),
    result(3, 'review-1', REVIEW_PENDING_RESULT),
    call(4, 'review-2', { action: 'rewrite', old: '丙', new: 'C' }),
    result(5, 'review-2', REVIEW_PENDING_RESULT),
  ]

  assert.deepEqual(
    deriveDraftStateFromSession(events).review,
    createDraftReview('甲乙丙', 'A乙C'),
  )
})

test('the next real request durably settles an earlier review candidate', () => {
  const events: SessionEvent[] = [
    request(1, '旧稿'),
    call(2, 'review-before-request', { action: 'write', content: '候选稿' }),
    result(3, 'review-before-request', REVIEW_PENDING_RESULT),
    request(4, '候选稿'),
  ]

  assert.deepEqual(deriveDraftStateFromSession(events), { draft: '候选稿', review: null })
})

test('successful rewrites apply while rendered semantic failures do not', () => {
  const events: SessionEvent[] = [
    request(1, '第一段\n\n第二段'),
    call(2, 'rewrite-1', { action: 'rewrite', old: '第二段', new: '改写后的第二段' }),
    result(3, 'rewrite-1', '草稿已写入写作板。'),
    call(4, 'rewrite-2', { action: 'rewrite', old: '不存在', new: '不应出现' }),
    result(5, 'rewrite-2', '错误：草稿中找不到原文'),
  ]

  assert.equal(deriveDraftFromSession(events), '第一段\n\n改写后的第二段')
})

test('successful Code Mode dispatches reconstruct the same model write', () => {
  const codeDispatch = event(2, 'tool/code-dispatch', {
    rootCallId: CallId('run-1'),
    parentCallId: CallId('run-1'),
    subCallId: CallId('run-1:code:1'),
    name: WRITE_FULL_DRAFT_TOOL,
    arguments: { content: 'Code Mode 写回' },
    isError: false,
    content: [{ type: 'text', text: '草稿已写入写作板。' }],
  })

  assert.equal(deriveDraftFromSession([request(1, ''), codeDispatch]), 'Code Mode 写回')
})

test('new Code Mode dispatches stage review candidates', () => {
  const codeDispatch = event(2, 'tool/code-dispatch', {
    rootCallId: CallId('run-review'),
    parentCallId: CallId('run-review'),
    subCallId: CallId('run-review:code:1'),
    name: WRITE_FULL_DRAFT_TOOL,
    arguments: { content: 'Code Mode 候选' },
    isError: false,
    content: [{ type: 'text', text: REVIEW_PENDING_RESULT }],
  })

  assert.deepEqual(
    deriveDraftStateFromSession([request(1, '原稿'), codeDispatch]).review,
    createDraftReview('原稿', 'Code Mode 候选'),
  )
})

test('legacy XML snapshots remain recoverable during migration', () => {
  const legacy = event(1, 'user/message', createUserMessage({
    content: [{ type: 'text', text: serializeDraftSnapshot('0.1.x 草稿') }],
    source: { kind: 'plugin', plugin: WRITING_PAD_PLUGIN, form: 'snapshot', sections: [] },
  }))

  assert.equal(deriveDraftFromSession([legacy]), '0.1.x 草稿')
  assert.equal(applyWritingDraftOperation('旧内容', { action: 'rewrite', old: '', new: '旧版全量写入' }), '旧版全量写入')
})
