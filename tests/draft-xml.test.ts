import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatWritingRequestDisplay,
  parseDraftContextMessage,
  parseDraftSnapshot,
  parseWritingRequest,
  parseWritingPadMessageDraft,
  projectDraftContextMessage,
  serializeDraftContextMessage,
  serializeDraftSnapshot,
  serializeWritingRequest,
} from '../src/draft-xml.ts'

test('draft snapshots round-trip arbitrary Markdown text', () => {
  const samples = [
    '',
    '# 标题\n\n正文 & <tag> 😀',
    '\n保留首尾换行\n',
    'before ]]> after',
    'literal ]]]]><![CDATA[> marker',
  ]
  for (const sample of samples) {
    assert.equal(parseDraftSnapshot(serializeDraftSnapshot(sample)), sample)
  }
  assert.match(
    serializeDraftSnapshot('# 标题'),
    /<draft>\n    <!\[CDATA\[# 标题\]\]>\n  <\/draft>/,
  )
})

test('snapshot parser ignores unrelated and unsupported envelopes', () => {
  assert.equal(
    parseDraftSnapshot('<dsh-writing-pad version="1"><draft><![CDATA[旧版正文]]></draft></dsh-writing-pad>'),
    '旧版正文',
  )
  assert.equal(parseDraftSnapshot('<draft>text</draft>'), null)
  assert.equal(parseDraftSnapshot('<dsh-writing-pad version="2"><draft><![CDATA[text]]></draft></dsh-writing-pad>'), null)
})

test('writing requests declare the operation, destination and selection', () => {
  const xml = serializeWritingRequest({
    operation: 'rewrite',
    draft: '# 当前草稿\n\n包含 ]]> 标记',
    instruction: '更简洁 ]]> 一些',
    selection: { mode: 'edit', start: 3, end: 5, text: '原文' },
  })
  assert.match(xml, /operation="rewrite"/)
  assert.match(xml, /selection mode="edit" start="3" end="5"/)
  assert.match(xml, /destination tool="rewrite_selected_text" required="true"/)
  assert.match(xml, /更简洁/)
  assert.equal(parseWritingPadMessageDraft(xml), '# 当前草稿\n\n包含 ]]> 标记')
  const parsed = parseWritingRequest(xml)
  assert.deepEqual(parsed, {
    operation: 'rewrite',
    draft: '# 当前草稿\n\n包含 ]]> 标记',
    instruction: '更简洁 ]]> 一些',
    selection: { mode: 'edit', start: 3, end: 5, text: '原文' },
  })
  assert.ok(parsed !== null)
  const display = formatWritingRequestDisplay(parsed)
  assert.equal(display, '修改内容\n原文\n\n额外要求\n更简洁 ]]> 一些')
  assert.doesNotMatch(display, /当前草稿/)

  const englishDisplay = formatWritingRequestDisplay(parsed, {
    selection: 'Selected passage',
    instruction: 'Additional instructions',
  })
  assert.equal(
    englishDisplay,
    'Selected passage\n原文\n\nAdditional instructions\n更简洁 ]]> 一些',
  )
  assert.doesNotMatch(englishDisplay, /当前草稿/)
})

test('draft context keeps the conversation message separate from rewrite instructions', () => {
  const text = serializeDraftContextMessage('# 待修改正文\n\n含 ]]> 标记', '请整体润色，不要改变标题')
  assert.deepEqual(parseDraftContextMessage(text), {
    draft: '# 待修改正文\n\n含 ]]> 标记',
    message: '请整体润色，不要改变标题',
  })
  assert.equal(parseWritingPadMessageDraft(text), '# 待修改正文\n\n含 ]]> 标记')
  assert.match(text, /<draft>\n    <!\[CDATA\[# 待修改正文/)
  assert.match(text, /标记\]\]>\n  <\/draft>/)
  assert.match(text, /<\/dsh-writing-pad-context>\n\n请整体润色/)
  assert.doesNotMatch(text, /<instruction>/)
})

test('draft context parser rejects unsupported or incomplete envelopes', () => {
  assert.equal(parseDraftContextMessage('<dsh-writing-pad-context version="2"></dsh-writing-pad-context>'), null)
  assert.equal(parseDraftContextMessage('<dsh-writing-pad-context version="1"></dsh-writing-pad-context>'), null)
  assert.equal(parseDraftContextMessage('普通用户消息'), null)
})

test('draft context projection always hides a recognized leading envelope', () => {
  assert.equal(
    projectDraftContextMessage([
      '<dsh-writing-pad-context version="1">',
      '  <unparseable>maintenance formatting must not leak</unparseable>',
      '</dsh-writing-pad-context>',
      '',
      '用户输入保持原样',
    ].join('\n')),
    '用户输入保持原样',
  )
  assert.equal(
    projectDraftContextMessage('<dsh-writing-pad-context version="1">broken</dsh-writing-pad-context>\n\n'),
    '',
  )
  assert.equal(projectDraftContextMessage('普通用户消息'), null)
})

test('custom display labels omit the selection heading for full writes', () => {
  assert.equal(
    formatWritingRequestDisplay(
      { operation: 'write', draft: 'hidden', instruction: 'Draft an introduction' },
      { selection: 'Selected passage', instruction: 'Additional instructions' },
    ),
    'Additional instructions\nDraft an introduction',
  )
})

test('full writes and selection rewrites route to different tools', () => {
  const write = serializeWritingRequest({ operation: 'write', draft: '', instruction: '起草' })
  const rewrite = serializeWritingRequest({
    operation: 'rewrite',
    draft: '原文',
    instruction: '改写',
    selection: { mode: 'edit', start: 0, end: 2, text: '原文' },
  })

  assert.match(write, /destination tool="write_full_draft" required="true"/)
  assert.match(rewrite, /destination tool="rewrite_selected_text" required="true"/)
  assert.match(rewrite, /<instruction>\n    <!\[CDATA\[改写\]\]>\n  <\/instruction>/)
  assert.match(rewrite, /<selection mode="edit" start="0" end="2">\n    <!\[CDATA\[原文\]\]>\n  <\/selection>/)
})

test('writing request parser rejects unrelated and unsupported envelopes', () => {
  assert.equal(parseWritingRequest('普通用户消息'), null)
  assert.equal(parseWritingRequest('请解释 <dsh-writing-pad-request version="1" operation="write"></dsh-writing-pad-request> 示例'), null)
  assert.equal(parseWritingRequest('<dsh-writing-pad-request version="2" operation="write"></dsh-writing-pad-request>'), null)
})
