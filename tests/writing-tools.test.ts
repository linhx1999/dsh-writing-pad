import assert from 'node:assert/strict'
import test from 'node:test'
import {
  REWRITE_SELECTED_TEXT_DESCRIPTION,
  REWRITE_SELECTED_TEXT_TOOL,
  WRITE_FULL_DRAFT_DESCRIPTION,
  WRITE_FULL_DRAFT_TOOL,
} from '../src/writing-tools.ts'

test('the two tool names make their document scope explicit', () => {
  assert.equal(WRITE_FULL_DRAFT_TOOL, 'write_full_draft')
  assert.equal(REWRITE_SELECTED_TEXT_TOOL, 'rewrite_selected_text')
})

test('full-draft writes exclude selection rewrites', () => {
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /包含 selection.+禁止调用本工具/)
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /rewrite_selected_text/)
})

test('selection rewrites constrain both arguments to the selected fragment', () => {
  assert.match(REWRITE_SELECTED_TEXT_DESCRIPTION, /selection 是唯一允许修改的范围/)
  assert.match(REWRITE_SELECTED_TEXT_DESCRIPTION, /old 只能是.+最小原文片段/)
  assert.match(REWRITE_SELECTED_TEXT_DESCRIPTION, /new 只能是 old 的局部替换内容/)
  assert.match(REWRITE_SELECTED_TEXT_DESCRIPTION, /old 命中片段之外的所有内容必须原样保留/)
})
