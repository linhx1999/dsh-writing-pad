# dsh-writing-pad

[简体中文](README.md) · [English](README.en.md)

Session-scoped writing pad for the DeepSeek Harness web GUI. It mounts a
right-details-column Markdown editor into the `details` slot, with:

- A labeled writing-pad toggle with an icon inside the composer tool row opens
  the right-side Markdown editor with edit and preview modes, including before
  a new session's first message; after submission it hands off to the standard
  details column.
- Selection-only AI rewrite: select text in edit or preview mode, optionally
  add an instruction, and send the rewrite request. The UI does not offer
  full-document generation. Each request carries the complete current draft
  in that same versioned XML user message, and `writing_draft` is the model's
  explicit destination.
- The transcript hides the model-facing XML. A writing-request bubble shows
  only the selected passage (when present) and the additional instruction;
  copying the row also copies only that visible projection. Ordinary
  user/steering messages retain their normal text, image, and extra-block
  presentation.
- A `writing_draft` agent tool with `read`, full-document `write`, and local
  `rewrite` (`old` + `new`) operations.
- Per-session drafts, debounced Host-memory staging, complete XML snapshots on
  real writing-request user messages, restart recovery by folding successful
  `writing_draft` outcomes, and 2-second model-writeback refresh. Drafts are
  never written into workspace files.
- Up to 50 undo steps per session; one staging window coalesces continuous
  typing, while clears and model writebacks also remain undoable.

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
│       ├── BlankDetailsLayoutBridge.tsx # blank-session details layout bridge
│       ├── WritingRequestMessage.tsx # user-row projection that hides XML
│       ├── WritingToggle.tsx
│       ├── blank-session.ts # current blank-session selector
│       ├── store.ts      # shared per-session state
│       ├── markdown.ts   # minimal Markdown renderer
│       └── writing-pad.css
├── README.md             # 简体中文（默认）
└── README.en.md          # English
```

## Install

Install the `dsh` CLI first, then add the stable release to the web profile:

```sh
dsh plugin --profile web add dsh-writing-pad@1.0.0
```

Inspect the plugin layer, then boot the web GUI:

```sh
dsh --profile web --dump-config   # shows a "# == dsh-writing-pad" layer
dsh --profile web
```

## Uninstall

Remove the plugin from the web profile:

```sh
dsh plugin --profile web remove dsh-writing-pad
```

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

The persistence boundary is the normal conversation boundary. Selecting text
and clicking “Send rewrite request” submits one real
`<dsh-writing-pad-request>` user message containing the complete `<draft>`, the
instruction, and the selection. The following `assistant(tool_calls)` must
remain directly adjacent to its `tool/result`, so `writing_draft` only updates
Host memory. Recovery folds the latest request snapshot together with
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
`operation=rewrite`, the natural-language requirement, and the selection, and
names `writing_draft` as its destination. The model applies the local edit with
`action=rewrite, old=..., new=...`; prose is not scraped from ordinary assistant
text. The Host tool retains `action=write` for direct calls and historical
compatibility, but the writing-pad UI has no full-document generation entry. A
successful call updates Host memory; the call/result pair is the recoverable
record and the client receives it through background polling.

The model and durable session still receive the original XML. On the client,
the plugin shadows the `user` and `steering` keys of
`conversation.chat.node` at a lower priority and summarizes only envelopes it
can parse as supported writing requests. The full `<draft>` never enters the
bubble. Unrecognized messages retain ordinary text, image, and extra-block
rendering and are never mistaken for writing requests.

Manual edits that have not yet travelled with a new rewrite request remain in
the current Host process only; closing the side panel does not manufacture a
user message. Send the next rewrite request when those edits should become part
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

The plugin always occupies the real `details` column and replaces the shipped
tool-details panel. Harness forces that column to zero width for a blank
session, so a `shell.overlay` layout bridge restores the existing grid track
without rendering a floating duplicate. The bridge withdraws after the first
message and standard layout management resumes. Ordinary assistant replies
never overwrite a draft; only a `writing_draft` call is a model write, which
keeps explanatory text out of the document.

## Open items

- Confirm the `@deepseek-ai/dsh-*` rc packages resolve from npm (or install
  the harness checkout as a git dependency) before `dsh plugin add` resolves.

## License

MIT
