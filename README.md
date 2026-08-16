# dsh-writing-pad

[![npm version](https://img.shields.io/npm/v/dsh-writing-pad?logo=npm)](https://www.npmjs.com/package/dsh-writing-pad)
[![npm downloads](https://img.shields.io/npm/dm/dsh-writing-pad?logo=npm)](https://www.npmjs.com/package/dsh-writing-pad)
[![license](https://img.shields.io/npm/l/dsh-writing-pad)](LICENSE)

[![简体中文文档](https://img.shields.io/badge/文档-简体中文-d73a49)](README.md)
[![English documentation](https://img.shields.io/badge/docs-English-0969da)](README.en.md)

面向 DeepSeek Harness Web 的会话级 Markdown 写作板。它直接停靠在对话右侧，让起草、预览和 AI 局部改写保持在同一个工作流中。

![dsh-writing-pad 在 DeepSeek Harness Web 中的写作板侧栏](docs/assets/writing-pad-overview.png)

## 亮点

- **随时打开**：可从输入框工具栏展开或收起写作板，并在切换会话或发送新会话首条消息时保持打开状态。
- **专注局部改写**：划选正文后可输入多行额外要求、保存默认要求并调整输入区域高度。
- **写作主动入板**：用户请求起草、撰写、续写或生成可用文本时，模型会优先通过 `write_full_draft` 生成完整候选稿；选区改写则使用 `rewrite_selected_text`。调用工具时写作板会自动打开，候选修改到达后会展示 Diff 并定位首个变更。
- **状态清晰**：界面会反馈暂存、复制、生成、待审核和失败等操作状态。
- **跟随宿主语言**：客户端界面随 dsh 的中文／English 设置即时切换。
- **对话保持简洁**：写作板非空时，完整草稿会作为独立上下文随主输入框消息送达模型；消息本身保持用户原文，不会显示或标记为“额外要求”。
- **会话级状态**：不同会话的草稿互不影响，支持编辑/预览、全文复制、清空以及最多 50 步撤销。
- **不修改工作区文件**：草稿暂存在 Host 内存中，不会自动创建或覆盖项目文件。

## 安装

需要先安装 `dsh` CLI。将最新稳定版插件安装到 Web profile：

```sh
dsh plugin --profile web add dsh-writing-pad
```

启动 Web 界面：

```sh
dsh web
```

本地开发时，可一键打包、重装当前版本并启动 Web：

```sh
pnpm dev
```

## 发布

先更新并提交 `package.json` 中的版本号，确保 `npm login` 已完成且工作区干净，然后运行：

```sh
pnpm publish
```

发布前钩子会执行类型检查、测试和打包校验，随后直接发布到 npm，不再要求额外输入确认。发布后钩子会验证版本并创建本地 `v<version>` 标签。脚本不会推送标签，确认无误后按提示手动推送。

## 使用

1. 在输入框工具行点击“写作板”。
2. 输入或粘贴 Markdown 正文，并按需切换“编辑/预览”。
3. 选中需要修改的内容，光标会自动跳到额外要求输入区。
4. 输入要求；Enter 发送，Shift+Enter 换行，也可将当前内容设为默认。
5. 模型写回后审核 Diff，选择“接受修改”或“拒绝修改”；直接离开审核则默认接受。

## 语言

写作板的客户端控件、状态提示和对话中的写作请求摘要随 dsh 宿主语言（中文／English）自动切换。额外要求为空时，插件会按发送时的界面语言选取默认改写要求并将其随请求发送；用户保存的默认要求始终保留原文。Host 工具描述、工具结果标记、XML 线格式和重放解析保持现有中文规范，不随界面语言改变。

## 数据与恢复

- 编辑内容会防抖暂存在当前 Host 进程中。
- 写作板非空时，从主输入框发送的每条真实用户消息都会携带独立的完整草稿上下文；用户原文位于上下文之外。选区改写请求仍通过自身的“额外要求”字段携带全文，两者都只产生一条 user 消息，界面会隐藏其中的全文。
- XML 中的草稿、额外要求和选区元素采用分行布局，便于直接检查会话记录，同时不改变 CDATA 中的原始文本。
- 重启后可从最近的写作请求和成功的写作工具结果恢复草稿及待审核候选；旧版 `writing_draft` 事件仍可兼容恢复，当前浏览器会重放已保存的审核决议。
- 尚未随任何用户消息发送的手工编辑不能跨 Host 进程恢复。

## 卸载

```sh
dsh plugin --profile web remove dsh-writing-pad
```

## 许可证

MIT
