# dsh-writing-pad

[English](README.md) · [简体中文](README.zh-CN.md)

Session-scoped writing pad for the DeepSeek Harness web GUI. It mounts a
right-details-column Markdown editor into the `details` slot, with:

- Markdown editing and a built-in preview pane (edit/preview toggle).
- AI-assisted rewrite: select a passage (in edit or preview), optionally add a
  natural-language requirement, and send the request into the conversation;
  the agent rewrites in-session and applies it through the `writing_draft`
  tool.
- A `writing_draft` agent tool (`action=read` / `action=rewrite` with `old` +
  `new`) so the agent can read and locally rewrite the draft.
- Workspace file save/load (relative `.md` files under the session workspace),
  per-session drafts, debounced autosave, and 2-second auto-sync so agent-side
  rewrites appear automatically.

## Repository layout

```
dsh-writing-pad/
├── package.json          # dsh.bundle + dsh.client manifests, exports, prepare
├── cordis.patch.yml      # the bundle layer: inserts the `writing-pad` row
├── tsdown.config.ts      # self-contained build (runs from `prepare`)
├── src/
│   ├── index.ts          # Host: WritingPadService (@Remote) + writing_draft tool
│   ├── remote.ts         # Remote descriptors, codecs, and client contribution
│   ├── typert.ts         # Host Typert contribution loaded through ./typert
│   └── client/
│       ├── index.tsx     # Client: slot registration, store, bridge wiring
│       ├── WritingPad.tsx
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
dsh plugin --profile web add ./dsh-writing-pad-0.1.0.tgz

# npm registry release; authenticate first with npm login.
pnpm publish --dry-run
pnpm publish --access public
dsh plugin --profile web add dsh-writing-pad@0.1.0
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

## Porting notes (from the dynamic-plugin prototype)

This package is the static, installable form of a writing pad prototyped as a
dynamic Cordis plugin. The conversion is mechanical:

| Dynamic plugin | Static bundle |
| --- | --- |
| `harness.defineTool` / `harness.registerTool` | `defineTool` + `ctx.tools.register` from `@deepseek-ai/dsh-tools` |
| `harness.handle` / `host.call` package-private RPC | `@Remote` methods on a `TypertRemoteService`; client calls `ctx.remote.writingPad.*` |
| Dynamic client builtins (`React`, `host`, `styles`) | Normal imports (`react`, `ctx.slots.register`, CSS) |
| Draft held in Host memory keyed by session | Same, plus workspace-file save/load |

Known behavior of the prototype carried over unchanged: drafts live in Host
memory per session (a file write is the durable form), the rewrite request is a
real user message into the conversation (agent applies it via `writing_draft`),
and the `details` column replaces the shipped tool-details panel while this
plugin occupies it.

## Open items

- Confirm the `@deepseek-ai/dsh-*` rc packages resolve from npm (or install
  the harness checkout as a git dependency) before `dsh plugin add` resolves.
- Decide whether drafts should be file-backed (write the `.md` file on every
  autosave and poll the file instead of Host memory) so agent-side file edits
  also sync into the pad automatically.

## License

MIT
