import assert from 'node:assert/strict'
import test from 'node:test'
import { CallId } from '@deepseek-ai/dsh-llm/brand'
import { createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm/message'
import type { SessionEvent, SessionEventMap, SessionEventType } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools/types'
import {
  applyWritingDraftOperation,
  deriveDraftFromSession,
  WRITING_PAD_PLUGIN,
} from '../src/draft-session.ts'
import { serializeDraftSnapshot, serializeWritingRequest } from '../src/draft-xml.ts'

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
): SessionEvent<'tool/call'> {
  return event(seq, 'tool/call', {
    turn: 1,
    step: 1,
    callId: CallId(callId),
    name: 'writing_draft',
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
    call(2, 'write-1', { action: 'write', content: '模型生成的新稿' }),
    result(3, 'write-1', '草稿已写入写作板。'),
  ]

  assert.deepEqual(events.map(item => item.type), ['user/message', 'tool/call', 'tool/result'])
  assert.equal(deriveDraftFromSession(events), '模型生成的新稿')
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
    name: 'writing_draft',
    arguments: { action: 'write', content: 'Code Mode 写回' },
    isError: false,
    content: [{ type: 'text', text: '草稿已写入写作板。' }],
  })

  assert.equal(deriveDraftFromSession([request(1, ''), codeDispatch]), 'Code Mode 写回')
})

test('legacy XML snapshots remain recoverable during migration', () => {
  const legacy = event(1, 'user/message', createUserMessage({
    content: [{ type: 'text', text: serializeDraftSnapshot('0.1.x 草稿') }],
    source: { kind: 'plugin', plugin: WRITING_PAD_PLUGIN, form: 'snapshot', sections: [] },
  }))

  assert.equal(deriveDraftFromSession([legacy]), '0.1.x 草稿')
  assert.equal(applyWritingDraftOperation('旧内容', { action: 'rewrite', old: '', new: '旧版全量写入' }), '旧版全量写入')
})
