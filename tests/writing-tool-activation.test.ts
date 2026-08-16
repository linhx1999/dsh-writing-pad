import assert from 'node:assert/strict'
import test from 'node:test'
import type { RunningToolCall, ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { latestWritingToolCallId } from '../src/client/writing-tool-activation.ts'

const runningCall = (
  callId: string,
  name: string,
  subCalls: readonly ToolCallBlock[] = [],
): RunningToolCall => ({
  callId,
  name,
  argsRaw: '{}',
  turn: 1,
  step: 1,
  time: 1,
  callView: null,
  subCalls,
})

const settledCall = (
  callId: string,
  name: string,
  subCalls: readonly ToolCallBlock[] = [],
): ToolResultNode => ({
  kind: 'tool-result',
  seq: 1,
  time: 2,
  callId,
  call: { name, argsRaw: '{}' },
  callTime: 1,
  content: [],
  isError: false,
  callView: null,
  resultView: null,
  subCalls,
})

test('ignores empty and unrelated tool-call trees', () => {
  assert.equal(latestWritingToolCallId([]), undefined)
  assert.equal(latestWritingToolCallId([runningCall('search-1', 'web_search')]), undefined)
})

test('recognizes both top-level writing tools', () => {
  assert.equal(latestWritingToolCallId([runningCall('full-1', 'write_full_draft')]), 'full-1')
  assert.equal(
    latestWritingToolCallId([runningCall('rewrite-1', 'rewrite_selected_text')]),
    'rewrite-1',
  )
})

test('recognizes running and settled Code Mode child calls', () => {
  const runningChild = runningCall('dispatch-1', 'tool/code-dispatch', [
    runningCall('rewrite-1', 'rewrite_selected_text'),
  ])
  assert.equal(latestWritingToolCallId([runningChild]), 'rewrite-1')

  const settledChild = runningCall('dispatch-2', 'tool/code-dispatch', [
    settledCall('full-2', 'write_full_draft'),
  ])
  assert.equal(latestWritingToolCallId([settledChild]), 'full-2')
})

test('returns the latest matching call in recursive start order', () => {
  const calls = [
    runningCall('full-1', 'write_full_draft'),
    runningCall('dispatch-1', 'tool/code-dispatch', [
      settledCall('rewrite-1', 'rewrite_selected_text'),
      runningCall('full-2', 'write_full_draft'),
    ]),
  ]
  assert.equal(latestWritingToolCallId(calls), 'full-2')
})
