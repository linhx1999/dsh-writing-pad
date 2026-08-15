# dsh-writing-pad

[简体中文](README.md) · [English](README.en.md)

面向 DeepSeek Harness Web 的会话级 Markdown 写作板。它直接停靠在对话右侧，让起草、预览和 AI 局部改写保持在同一个工作流中。

![dsh-writing-pad 在 DeepSeek Harness Web 中的写作板侧栏](docs/assets/writing-pad-overview.png)

## 亮点

- **随时打开**：输入框中的“写作板”按钮可展开或收起右侧栏；新建会话发送首条消息前也能使用。
- **专注局部改写**：选中正文，补充可选要求，然后发送改写请求；界面不会意外生成或替换全文。
- **模型结果明确写回**：模型通过 `writing_draft` 工具更新草稿，普通 assistant 回复不会被误当成正文。
- **对话保持简洁**：完整草稿随请求发送给模型，但消息气泡只显示选中的修改内容和额外要求。
- **会话级状态**：不同会话的草稿互不影响，支持编辑/预览、清空以及最多 50 步撤销。
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

## 使用

1. 在输入框工具行点击“写作板”。
2. 输入或粘贴 Markdown 正文，并按需切换“编辑/预览”。
3. 选中需要修改的内容。
4. 输入可选的额外要求，点击“发送改写请求”。
5. 等待模型通过 `writing_draft` 写回结果；需要时可点击“撤销”。

## 数据与恢复

- 编辑内容会防抖暂存在当前 Host 进程中。
- 发送改写请求时，当前完整草稿会包含在同一条 XML user 消息中；界面会隐藏这部分 XML。
- 重启后可从最近的写作请求和成功的 `writing_draft` 结果恢复草稿。
- 尚未随改写请求发送的手工编辑不能跨 Host 进程恢复。

## 卸载

```sh
dsh plugin --profile web remove dsh-writing-pad
```

## 许可证

MIT
