/** Names and model-facing contracts for the two writing operations. */
export const WRITE_FULL_DRAFT_TOOL = 'write_full_draft'
export const REWRITE_SELECTED_TEXT_TOOL = 'rewrite_selected_text'
export const LEGACY_WRITING_DRAFT_TOOL = 'writing_draft'

export const WRITE_FULL_DRAFT_DESCRIPTION =
  '为当前会话的写作板生成或替换完整 Markdown 草稿。' +
  '仅当 <dsh-writing-pad-request operation="write"> 明确指定 tool="write_full_draft" 时调用。' +
  '传入可直接放入写作板的完整正文；不要只在普通 assistant 回复中给出正文。' +
  '当请求包含 selection 或 operation="rewrite" 时禁止调用本工具，应调用 rewrite_selected_text。' +
  '成功后完整候选稿会在写作板中等待用户审核；随后只需简短确认。'

export const REWRITE_SELECTED_TEXT_DESCRIPTION =
  '只改写当前写作板中用户选中的局部文本。' +
  '仅当 <dsh-writing-pad-request operation="rewrite"> 明确指定 tool="rewrite_selected_text" 时调用。' +
  'selection 是唯一允许修改的范围：old 只能是选中内容在完整 Markdown 草稿中对应的最小原文片段，' +
  '必须与源码逐字一致（含 Markdown 标记）；不得把完整草稿或未选中段落放入 old。' +
  'new 只能是 old 的局部替换内容，不得传入改写后的完整草稿；old 命中片段之外的所有内容必须原样保留。' +
  'preview 选区可能不含 Markdown 标记，应先在完整草稿中定位对应的最小源码片段，再复制为 old。' +
  '成功后局部候选修改会在写作板中等待用户审核；随后只需简短确认。'
