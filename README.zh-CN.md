# dsh-writing-pad

[English](README.md) · [简体中文](README.zh-CN.md)

面向 DeepSeek Harness Web 界面的会话级写作板。它在 `details` 槽位中挂载一个右侧栏 Markdown 编辑器，功能包括：

- Markdown 编辑与内置预览（编辑/预览切换）。
- AI 辅助改写：选中一段文字（编辑或预览模式均可），可选填写自然语言要求，把请求作为真实消息发送进会话；agent 在会话内完成改写，并通过 `writing_draft` 工具应用到草稿。
- `writing_draft` agent 工具（`action=read` / `action=rewrite`，入参 `old` + `new`），让 agent 可以读取并就地改写草稿。
- 工作区文件保存/加载（会话工作区下的相对 `.md` 文件）、按会话隔离的草稿、防抖自动保存，以及 2 秒自动同步——agent 侧的改写会自动出现在写作板中。

## 仓库结构

```
dsh-writing-pad/
├── package.json          # dsh.bundle + dsh.client 双清单、exports、prepare
├── cordis.patch.yml      # bundle 层：插入 `writing-pad` 插件行
├── tsdown.config.ts      # 自包含构建（由 `prepare` 触发）
├── src/
│   ├── index.ts          # Host：WritingPadService（@Remote）+ writing_draft 工具
│   ├── remote.ts         # Remote 描述符、编解码器和 Client contribution
│   ├── typert.ts         # 通过 ./typert 加载的 Host Typert contribution
│   └── client/
│       ├── index.tsx     # Client：槽位注册、store、桥接装配
│       ├── WritingPad.tsx
│       ├── WritingToggle.tsx
│       ├── store.ts      # 按会话共享的状态
│       ├── markdown.ts   # 极简 Markdown 渲染器
│       └── writing-pad.css
├── README.md             # English
└── README.zh-CN.md       # 简体中文
```

## 安装

需要 `dsh` CLI（`dsh --profile web` 启动 Web 界面）。从 GitHub 安装：

```sh
dsh plugin --profile web add github:you/dsh-writing-pad#<commit>
```

git 安装会拉取源码，因此包的 `prepare` 脚本（tsdown）必须能构建入口。pnpm ≥ 10 在显式允许之前会拒绝执行 git 依赖的 `prepare`：第一次 `add` 会失败，`dsh` 会打印出确切的包 key——把它复制进该 profile 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-writing-pad: true
```

然后重新执行 `add`。只允许你信任的源码，并固定提交号，避免后续推送悄悄改变实际运行的内容。不想要 allowlist 的替代方案：发布到 npm（预构建的 `dist/`）后执行 `dsh plugin add dsh-writing-pad`，或用 `pnpm pack` 打 tar 包分发。

不启动即验证，然后再启动：

```sh
dsh --profile web --dump-config   # 会显示 "# == dsh-writing-pad" 层
dsh --profile web
```

## 构建

```sh
pnpm install
pnpm build          # tsdown → dist/index.js + dist/client.js + Remote 产物
pnpm typecheck      # tsc --noEmit（需要已安装 dev 依赖）
```

git 安装后 `prepare` 会自动执行 `pnpm build`。

### 依赖发布时间策略

本仓库继续启用 pnpm 的依赖发布时间保护。本次构建明确接受的 Harness RC 精确版本列在 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 中，其他包仍然受正常的最短发布时间限制。以后升级 Harness 依赖时，应先检查锁文件变化，再决定是否接受新增的精确版本例外；不要为了让安装通过而全局关闭该策略。

## 打包与发布

先更新 `package.json` 中的 `version`；registry 上的同一版本不能重复发布。完成验证后，可选择 tarball 或 npm：

```sh
pnpm typecheck
pnpm build

# 可移植的预构建 tarball；安装时不需要授予构建脚本权限
pnpm pack
dsh plugin --profile web add ./dsh-writing-pad-0.1.0.tgz

# 发布到 npm registry；先执行 npm login 完成认证
pnpm publish --dry-run
pnpm publish --access public
dsh plugin --profile web add dsh-writing-pad@0.1.0
```

`files` 会把两种发布形式都限制为 `dist/`、bundle patch、文档、许可证和包清单。分发前可用 `pnpm pack --dry-run` 检查包内容。

## Client→Host 桥接

Client 通过 typert **Remote** 服务 `WritingPadService` 调用 Host。`src/remote.ts` 包含严格的 wire codec 和 `TYPERT_REMOTE` Client contribution，`src/typert.ts` 则把同一组描述符暴露为 Host `TYPERT` contribution。Harness Loader 会发现 `./typert`，浏览器模块则通过 `ctx.remote.$mount(contribution)` 挂载 `./remote`。插件因此可以自包含发布，不需要修改 Harness 的 `dsh-api-remotes` 白名单。

## 移植说明（来自动态插件原型）

本包是写作板作为动态 Cordis 插件原型验证后的静态、可安装形态。转换是机械性的：

| 动态插件 | 静态 bundle |
| --- | --- |
| `harness.defineTool` / `harness.registerTool` | `@deepseek-ai/dsh-tools` 的 `defineTool` + `ctx.tools.register` |
| `harness.handle` / `host.call` 包私有 RPC | `TypertRemoteService` 上的 `@Remote` 方法；Client 调用 `ctx.remote.writingPad.*` |
| 动态 Client 内置（`React`、`host`、`styles`） | 常规导入（`react`、`ctx.slots.register`、CSS） |
| 草稿存在 Host 内存中、按会话隔离 | 相同，外加工作区文件保存/加载 |

原型中已知行为原样保留：草稿按会话存在 Host 内存（写文件才是持久形态），改写请求是进入会话的真实用户消息（agent 通过 `writing_draft` 应用），本插件占用 `details` 列期间会替换自带的工具详情面板。

## 待办事项

- 在 `dsh plugin add` 解析依赖之前，先确认 `@deepseek-ai/dsh-*` rc 包能从 npm 解析（或把 harness 检出目录作为 git 依赖安装）。
- 决定草稿是否改为文件持久化（每次自动保存都写 `.md` 文件，轮询文件而不是 Host 内存），让 agent 侧的文件编辑也能自动同步进写作板。

## 许可证

MIT
