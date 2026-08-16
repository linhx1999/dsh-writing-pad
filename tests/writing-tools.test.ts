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

test('full-draft writes proactively handle concrete writing requests', () => {
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /只要用户表达要写.+就应积极且优先调用本工具/)
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /无需用户提到“写作板”、工具名或 XML/)
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /文章、故事、文案、邮件、报告/)
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /不要因为缺少次要细节而放弃调用/)
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /不要把成稿只放在普通 assistant 回复中/)
})

test('full-draft writes exclude selection rewrites and writing-only discussion', () => {
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /包含 selection.+禁止调用本工具/)
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /rewrite_selected_text/)
  assert.match(WRITE_FULL_DRAFT_DESCRIPTION, /只是询问写作方法、分析或评价.+则不调用/)
})

test('selection rewrites constrain both arguments to the selected fragment', () => {
  assert.match(REWRITE_SELECTED_TEXT_DESCRIPTION, /selection 是唯一允许修改的范围/)
  assert.match(REWRITE_SELECTED_TEXT_DESCRIPTION, /old 只能是.+最小原文片段/)
  assert.match(REWRITE_SELECTED_TEXT_DESCRIPTION, /new 只能是 old 的局部替换内容/)
  assert.match(REWRITE_SELECTED_TEXT_DESCRIPTION, /old 命中片段之外的所有内容必须原样保留/)
})
