# dsh-writing-pad

[English](README.md) · [简体中文](README.zh-CN.md)

Session-scoped writing pad for the DeepSeek Harness web GUI. It mounts a
right-details-column Markdown editor into the `details` slot, with:

- Markdown editing and a built-in preview pane (edit/preview toggle).
- AI generation and rewrite: with no selection, a requirement generates or
  replaces the full document; with a selection, it rewrites that passage. Each
  writing request carries the complete current draft in that same versioned
  XML user message, and `writing_draft` is the model's explicit destination.
- The transcript hides the model-facing XML. A writing-request bubble shows
  only the selected passage (when present) and the additional instruction;
  copying the row also copies only that visible projection. Ordinary
  user/steering messages retain their normal text, image, and extra-block
  presentation.
- A `writing_draft` agent tool with `read`, full-document `write`, and local
  `rewrite` (`old` + `new`) operations.
- Per-session drafts, debounced Host-memory staging, complete XML snapshots on
  real writing-request user messages, restart recovery by folding successful
  `writing_draft` outcomes, and 2-second auto-sync. Drafts are never written
  into workspace files.

## Repository layout

```
dsh-writing-pad/
├── package.json          # dsh.bundle + dsh.client manifests, exports, prepare
├── cordis.patch.yml      # the bundle layer: inserts the `writing-pad` row
├── tsdown.config.ts      # self-contained build (runs from `prepare`)
├── src/
│   ├── index.ts          # Host: WritingPadService (@Remote) + writing_draft tool
│   ├── draft-xml.ts      # versioned XML drafts and writing requests
│   ├── draft-session.ts  # recovery from user requests and tool outcomes
│   ├── remote.ts         # Remote descriptors, codecs, and client contribution
│   ├── typert.ts         # Host Typert contribution loaded through ./typert
│   └── client/
│       ├── index.tsx     # Client: slot registration, store, bridge wiring
│       ├── WritingPad.tsx
│       ├── WritingRequestMessage.tsx # user-row projection that hides XML
│       ├── WritingToggle.tsx
│       ├── store.ts      # shared per-session state
│       ├── markdown.ts   # minimal Markdown renderer
│       └── writing-pad.css
├── README.md             # English
└── README.zh-CN.md       # 简体中文
```

## Install

Requires the `dsh` CLI (`dsh --profile web` boots the web GUI). From a GitHub
host:

```sh
dsh plugin --profile web add github:you/dsh-writing-pad#<commit>
```

A git install fetches sources, so the package's `prepare` script (tsdown) must
build the entry points. pnpm ≥ 10 refuses to run a git dependency's `prepare`
until it is explicitly allowed: the first `add` fails and `dsh` prints the
exact package key — copy it into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-writing-pad: true
```

and re-run the `add`. Allow only source you trust, and pin a commit so a later
push cannot silently change what runs. Alternatives without the allowance:
publish to npm (prebuilt `dist/`) and run `dsh plugin add dsh-writing-pad`, or
ship a tarball from `pnpm pack`.

Verify without booting, then boot:

```sh
dsh --profile web --dump-config   # shows a "# == dsh-writing-pad" layer
dsh --profile web
```

## Build

```sh
pnpm install
pnpm build          # tsdown → dist/index.js + dist/client.js + Remote artifacts
pnpm typecheck      # tsc --noEmit (needs dev dependencies installed)
pnpm test           # XML codec and session-recovery tests
```

`prepare` runs `pnpm build` automatically after a git install.

### Dependency release-age policy

This checkout keeps pnpm's release-age protection enabled. The exact Harness
RC versions intentionally accepted for this build are listed under `minimumReleaseAgeExclude`
in `pnpm-workspace.yaml`; every other package remains subject to the normal
minimum-age check. When updating Harness dependencies, inspect the lockfile
changes before accepting additional exact exclusions. Do not disable the
policy globally just to make an install pass.

## Package and publish

First update `version` in `package.json`; a registry version cannot be
republished. Then verify the package and choose either a tarball or npm:

```sh
pnpm typecheck
pnpm build

# Portable prebuilt tarball; no install-time build permission is required.
pnpm pack
dsh plugin --profile web add ./dsh-writing-pad-0.2.1.tgz

# npm registry release; authenticate first with npm login.
pnpm publish --dry-run
pnpm publish --access public
dsh plugin --profile web add dsh-writing-pad@0.2.1
```

`files` limits both release forms to `dist/`, the bundle patch, documentation,
license, and package manifest. Inspect the tarball before distributing it with
`pnpm pack --dry-run`.

## Client→Host bridge

The client calls the host through the typert **Remote** service
`WritingPadService`. `src/remote.ts` contains strict wire codecs and the
`TYPERT_REMOTE` client contribution; `src/typert.ts` exposes the same
descriptors as the Host `TYPERT` contribution. The Harness loader discovers
`./typert`, while the browser module mounts `./remote` with
`ctx.remote.$mount(contribution)`. This keeps the plugin self-contained and
requires no change to the Harness `dsh-api-remotes` allowlist.

The Remote interface has two draft operations: `saveDraft` stages into Host
memory and `loadDraft` reads that memory, falling back to session-log recovery
after a process restart. There is deliberately no standalone `checkpointDraft`,
and the plugin never inserts a synthetic user message while a tool is running.

The persistence boundary is the normal conversation boundary. Clicking
“Generate document” or “Send rewrite request” submits one real
`<dsh-writing-pad-request>` user message containing the complete `<draft>`, the
instruction, and an optional selection. The following `assistant(tool_calls)`
must remain directly adjacent to its `tool/result`, so `writing_draft` only
updates Host memory. Recovery folds the latest request snapshot together with
successful native and Code Mode `writing_draft` operations in log order.

The api-gateway installs each mounted namespace as a Cordis service named
`remote.<namespace>`, and reading `ctx.remote.writingPad` requires that
qualified name in the caller fiber's `inject` (the framework's own
`remote.commands` pattern). Because this package mounts its own namespace, the
module-level inject cannot include it — the fiber would wait for a service it
only mounts inside `apply`, a boot deadlock. `src/client/index.tsx` therefore
mounts the namespace in `apply` and builds the bridge inside a child fiber
(`ctx.plugin({ inject: ['remote.writingPad'], ... })`) that activates once the
namespace exists.

## Model output flow

One `<dsh-writing-pad-request>` carries the complete current `<draft>`,
`operation=write|rewrite`, the natural-language requirement, and an optional
selection, and names `writing_draft` as its destination. Generated prose is not
scraped from ordinary assistant text: a complete result uses
`action=write, content=...`, while a local edit uses
`action=rewrite, old=..., new=...`. A successful tool call updates Host memory;
the call/result pair is itself the recoverable record and appears in the client
on its next sync poll. The assistant only needs to acknowledge completion.

The model and durable session still receive the original XML. On the client,
the plugin shadows the `user` and `steering` keys of
`conversation.chat.node` at a lower priority and summarizes only envelopes it
can parse as supported writing requests. The full `<draft>` never enters the
bubble. Unrecognized messages retain ordinary text, image, and extra-block
rendering and are never mistaken for writing requests.

Manual edits that have not yet travelled with a new writing request remain in
the current Host process only; closing the side panel does not manufacture a
user message. Send the next writing request when those edits should become part
of recoverable conversation history.

## Porting notes (from the dynamic-plugin prototype)

This package is the static, installable form of a writing pad prototyped as a
dynamic Cordis plugin. The conversion is mechanical:

| Dynamic plugin | Static bundle |
| --- | --- |
| `harness.defineTool` / `harness.registerTool` | `defineTool` + `ctx.tools.register` from `@deepseek-ai/dsh-tools` |
| `harness.handle` / `host.call` package-private RPC | `@Remote` methods on a `TypertRemoteService`; client calls `ctx.remote.writingPad.*` |
| Dynamic client builtins (`React`, `host`, `styles`) | Normal imports (`react`, `ctx.slots.register`, CSS) |
| Draft held in Host memory keyed by session | Memory staging plus full XML drafts in user requests and tool-outcome replay |

The `details` column replaces the shipped tool-details panel while this plugin
occupies it. Ordinary assistant replies never overwrite a draft; only a
`writing_draft` call is a model write, which keeps explanatory text out of the
document.

## Open items

- Confirm the `@deepseek-ai/dsh-*` rc packages resolve from npm (or install
  the harness checkout as a git dependency) before `dsh plugin add` resolves.

## License

MIT
