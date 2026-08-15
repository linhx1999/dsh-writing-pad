# dsh-writing-pad

[简体中文](README.md) · [English](README.en.md)

面向 DeepSeek Harness Web 界面的会话级写作板。它在 `details` 槽位中挂载一个右侧栏 Markdown 编辑器，功能包括：

- 输入框工具行内提供带图标和“写作板”文字的开关，可展开右侧 Markdown 编辑器并切换编辑/预览模式；新建会话在发送首条消息前也可打开，发送后会自动交接到标准侧栏。
- AI 局部改写：在编辑或预览模式中选中文字，再输入可选的额外要求并发送改写请求。未选中内容时不能发送，界面不提供全文生成功能。每条改写请求都把当前完整草稿放进同一条版本化 XML user 消息，模型通过 `writing_draft` 把结果明确写回写作板。
- 对话区不会显示模型所需的完整 XML：写作请求气泡只呈现“修改内容”（有选区时）和“额外要求”，复制操作也只复制这份可见摘要。普通 user/steering 消息仍按原有气泡能力呈现。
- `writing_draft` agent 工具提供 `read`、`write` 和 `rewrite`：`write` 接收完整 Markdown 正文，`rewrite` 使用逐字匹配的 `old` + `new` 局部替换。
- 草稿按会话隔离，编辑时防抖暂存在 Host 内存；发送新写作请求时，完整草稿随该条 user 消息持久化。模型写回由成功的 `writing_draft` 工具调用/结果记录，重启后可将两类记录折叠还原。草稿不会写入工作区文件。
- 每个会话保留最多 50 步撤销历史；连续输入在同一次暂存窗口内合并为一步，清空和模型写回也可以撤销。

## 仓库结构

```
dsh-writing-pad/
├── package.json          # dsh.bundle + dsh.client 双清单、exports、prepare
├── cordis.patch.yml      # bundle 层：插入 `writing-pad` 插件行
├── tsdown.config.ts      # 自包含构建（由 `prepare` 触发）
├── src/
│   ├── index.ts          # Host：WritingPadService（@Remote）+ writing_draft 工具
│   ├── draft-xml.ts      # 版本化 XML 草稿与写作请求
│   ├── draft-session.ts  # 从 user 请求与工具结果还原草稿
│   ├── remote.ts         # Remote 描述符、编解码器和 Client contribution
│   ├── typert.ts         # 通过 ./typert 加载的 Host Typert contribution
│   └── client/
│       ├── index.tsx     # Client：槽位注册、store、桥接装配
│       ├── WritingPad.tsx
│       ├── BlankDetailsLayoutBridge.tsx # 空白会话 details 布局桥接
│       ├── WritingRequestMessage.tsx # 隐藏 XML 的 user 消息呈现投影
│       ├── WritingToggle.tsx
│       ├── blank-session.ts # 当前空白会话选择器
│       ├── store.ts      # 按会话共享的状态
│       ├── markdown.ts   # 极简 Markdown 渲染器
│       └── writing-pad.css
├── README.md             # 简体中文（默认）
└── README.en.md          # English
```

## 安装

需要先安装 `dsh` CLI。将稳定版本安装到 Web profile：

```sh
dsh plugin --profile web add dsh-writing-pad@1.0.0
```

检查插件配置层，然后启动 Web 界面：

```sh
dsh --profile web --dump-config   # 会显示 "# == dsh-writing-pad" 层
dsh --profile web
```

## 卸载

从 Web profile 中移除插件：

```sh
dsh plugin --profile web remove dsh-writing-pad
```

## Client→Host 桥接

Client 通过 typert **Remote** 服务 `WritingPadService` 调用 Host。`src/remote.ts` 包含严格的 wire codec 和 `TYPERT_REMOTE` Client contribution，`src/typert.ts` 则把同一组描述符暴露为 Host `TYPERT` contribution。Harness Loader 会发现 `./typert`，浏览器模块则通过 `ctx.remote.$mount(contribution)` 挂载 `./remote`。插件因此可以自包含发布，不需要修改 Harness 的 `dsh-api-remotes` 白名单。

Remote interface 只有两个草稿操作：`saveDraft` 做低成本 Host 内存暂存，`loadDraft` 优先读取内存；进程重启后则从会话日志还原。插件不提供独立的 `checkpointDraft`，也不会在工具执行期间插入合成 user 消息。

持久化边界就是正常对话边界：用户选中文字并点击“发送改写请求”时，插件只提交一条真实的 `<dsh-writing-pad-request>` user 消息，其中同时包含完整 `<draft>`、要求和选区。LLM 随后的 `assistant(tool_calls)` 必须直接跟对应 `tool/result`；`writing_draft` 因此只更新 Host 内存，不追加消息。恢复时，插件按顺序折叠最近的请求草稿以及成功的原生/Code Mode `writing_draft` 操作。

## 模型输出流

写作板发出的单条 `<dsh-writing-pad-request>` 包含当前完整 `<draft>`、`operation=rewrite`、自然语言要求和选区，并声明目标工具 `writing_draft`。模型通过 `action=rewrite, old=..., new=...` 写入局部修改，不依赖普通 assistant 文本解析。Host 工具仍保留 `action=write` 供直接调用和历史兼容，但写作板界面不提供全文生成入口。工具成功后只更新 Host 内存；调用/结果本身已经是可恢复记录，Client 通过后台轮询接收结果，assistant 只需做简短确认。

模型侧和持久会话仍接收上述 XML 原文。Client 以较低优先级覆盖 `conversation.chat.node` 的 `user`/`steering` 呈现槽位，只对能解析为受支持写作请求的消息生成摘要；XML 中的完整 `<draft>` 不进入气泡。无法识别的消息走同一组件的普通文本、图片和附加块呈现，不会被误判为写作请求。

尚未随新改写请求发送的手工编辑只存在于当前 Host 进程内；关闭侧栏不会制造一条 user 消息。需要把最新手工修改纳入可恢复会话历史时，发送下一条改写请求即可。

## 移植说明（来自动态插件原型）

本包是写作板作为动态 Cordis 插件原型验证后的静态、可安装形态。转换是机械性的：

| 动态插件 | 静态 bundle |
| --- | --- |
| `harness.defineTool` / `harness.registerTool` | `@deepseek-ai/dsh-tools` 的 `defineTool` + `ctx.tools.register` |
| `harness.handle` / `host.call` 包私有 RPC | `TypertRemoteService` 上的 `@Remote` 方法；Client 调用 `ctx.remote.writingPad.*` |
| 动态 Client 内置（`React`、`host`、`styles`） | 常规导入（`react`、`ctx.slots.register`、CSS） |
| 草稿存在 Host 内存中、按会话隔离 | 内存暂存 + user 请求内完整 XML 草稿 + 工具结果折叠恢复 |

本插件始终占用真正的 `details` 列并替换自带的工具详情面板。Harness 会将空白会话的该列宽度强制为零，因此插件通过一个 `shell.overlay` 布局桥接恢复原列宽，而不会渲染悬浮副本；首条消息发送后桥接退出，由标准布局继续管理侧栏。普通 assistant 回复不会自动覆盖草稿；只有 `writing_draft` 工具调用才是模型写入出口，避免把解释文字误当作正文。

## 待办事项

- 在 `dsh plugin add` 解析依赖之前，先确认 `@deepseek-ai/dsh-*` rc 包能从 npm 解析（或把 harness 检出目录作为 git 依赖安装）。

## 许可证

MIT
