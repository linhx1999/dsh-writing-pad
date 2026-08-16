# dsh-writing-pad

[简体中文](README.md) · [English](README.en.md)

面向 DeepSeek Harness Web 的会话级 Markdown 写作板。它直接停靠在对话右侧，让起草、预览和 AI 局部改写保持在同一个工作流中。

![dsh-writing-pad 在 DeepSeek Harness Web 中的写作板侧栏](docs/assets/writing-pad-overview.png)

## 亮点

- **随时打开**：可从输入框工具栏展开或收起写作板，并在切换会话时保持打开状态。
- **专注局部改写**：划选正文后可输入多行额外要求、保存默认要求并调整输入区域高度。
- **改写先审核再应用**：模型通过全文写入工具 `write_full_draft` 或局部改写工具 `rewrite_selected_text` 生成 Diff 候选稿，支持接受或拒绝，离开审核时默认接受。
- **状态清晰**：界面会反馈暂存、复制、生成、待审核和失败等操作状态。
- **对话保持简洁**：完整草稿随请求发送给模型，但消息气泡只显示选中的修改内容和额外要求。
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

## 数据与恢复

- 编辑内容会防抖暂存在当前 Host 进程中。
- 发送改写请求时，当前完整草稿会包含在同一条 XML user 消息中；界面会隐藏这部分 XML。
- 重启后可从最近的写作请求和成功的写作工具结果恢复草稿及待审核候选；旧版 `writing_draft` 事件仍可兼容恢复，当前浏览器会重放已保存的审核决议。
- 尚未随改写请求发送的手工编辑不能跨 Host 进程恢复。

## 卸载

```sh
dsh plugin --profile web remove dsh-writing-pad
```

## 许可证

MIT
