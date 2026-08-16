# dsh-writing-pad

[![npm version](https://img.shields.io/npm/v/dsh-writing-pad?logo=npm)](https://www.npmjs.com/package/dsh-writing-pad)
[![npm downloads](https://img.shields.io/npm/dm/dsh-writing-pad?logo=npm)](https://www.npmjs.com/package/dsh-writing-pad)
[![license](https://img.shields.io/npm/l/dsh-writing-pad)](LICENSE)

[![简体中文文档](https://img.shields.io/badge/文档-简体中文-d73a49)](README.md)
[![English documentation](https://img.shields.io/badge/docs-English-0969da)](README.en.md)

A session-scoped Markdown writing pad for the DeepSeek Harness web GUI. It docks beside the conversation, keeping drafting, preview, and focused AI rewrites in one workflow.

![The dsh-writing-pad side panel in the DeepSeek Harness web GUI](docs/assets/writing-pad-overview.png)

## Highlights

- **Open it anytime:** open or close the writing pad from the composer toolbar and keep it open while switching sessions or sending a new session's first message.
- **Focused rewrites:** select text, enter multi-line instructions, save reusable defaults, and resize the instruction area.
- **Proactive writing-pad delivery:** when users ask to draft, write, continue, or generate usable text, the model prioritizes `write_full_draft` for a complete candidate; selection edits use `rewrite_selected_text`. A tool call opens the writing pad automatically, then the candidate reveals its Diff at the first change.
- **Visible state:** the UI reports saving, copying, generation, pending review, and failure states.
- **Host-synchronized language:** client UI copy switches immediately with dsh's 中文/English setting.
- **Clean conversations:** while the writing pad is non-empty, the complete draft travels as separate context beside the main-composer message; the message remains the user's original text and is never labelled as an additional instruction.
- **Session-scoped state:** drafts remain isolated by session, with edit/preview modes, full-draft copy, clear, and up to 50 undo steps.
- **No workspace writes:** drafts are staged in Host memory and never create or overwrite project files automatically.

## Install

Install the `dsh` CLI first, then add the latest stable release to the web profile:

```sh
dsh plugin --profile web add dsh-writing-pad
```

Start the web GUI:

```sh
dsh web
```

For local development, package and reinstall the current version, then start the web GUI with:

```sh
pnpm dev
```

## Release

Update and commit the version in `package.json`, make sure `npm login` is complete and the working tree is clean, then run:

```sh
pnpm publish
```

The prepublish hook runs type checks, tests, and package verification before publishing directly to npm without an extra confirmation prompt. The postpublish hook verifies the version and creates the local `v<version>` tag. It does not push the tag; review the release and follow the printed command to push it manually.

## Usage

1. Click “Writing Pad” in the composer tool row.
2. Enter or paste Markdown and switch between edit and preview as needed.
3. Select the passage to change; focus moves to the additional-instruction editor.
4. Enter instructions. Press Enter to send or Shift+Enter for a new line, and optionally save the text as your default.
5. Review the highlighted Diff and accept or reject it. Leaving review without choosing accepts the candidate by default.

## Language

The writing pad's client controls, status feedback, and writing-request summaries follow the dsh Host language setting (中文/English). When additional instructions are empty, the plugin chooses the default rewrite instruction in the active UI language at send time and includes it in the request. User-saved default instructions always retain their original text. Host tool descriptions, tool-result markers, the XML wire format, and replay parsing retain their existing Chinese conventions and do not change with the UI language.

## Data and recovery

- Edits are debounced into the current Host process's memory.
- While the writing pad is non-empty, every real user message from the main composer carries a separate complete-draft context, with the user's original text outside that context. Selection rewrites retain their own additional-instruction field and also carry the full draft. Both paths produce one user message whose full draft stays hidden in the UI.
- Draft, additional-instruction, and selection elements use a multiline XML layout for readable transcript inspection without changing the original CDATA text.
- After a restart, the plugin recovers the latest accepted draft and pending writing-tool candidate; legacy `writing_draft` events remain recoverable, and this browser replays stored review decisions.
- Manual edits that have not travelled with any user message do not survive a Host-process restart.

## Uninstall

```sh
dsh plugin --profile web remove dsh-writing-pad
```

## License

MIT
