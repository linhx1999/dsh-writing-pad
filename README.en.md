# dsh-writing-pad

[简体中文](README.md) · [English](README.en.md)

A session-scoped Markdown writing pad for the DeepSeek Harness web GUI. It docks beside the conversation, keeping drafting, preview, and focused AI rewrites in one workflow.

![The dsh-writing-pad side panel in the DeepSeek Harness web GUI](docs/assets/writing-pad-overview.png)

## Highlights

- **Open it anytime:** the labeled writing-pad control in the composer opens or closes the right column, including before a new session's first message.
- **Focused rewrites:** select text, add an optional instruction, and submit a rewrite; the UI never generates or replaces the full document unexpectedly.
- **Explicit model writeback:** the model updates the draft through `writing_draft`. Ordinary assistant replies never become document content.
- **Clean conversations:** the complete draft reaches the model, while the visible message bubble shows only the selected passage and additional instruction.
- **Session-scoped state:** drafts remain isolated by session, with edit/preview modes, clear, and up to 50 undo steps.
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

## Usage

1. Click “Writing Pad” in the composer tool row.
2. Enter or paste Markdown and switch between edit and preview as needed.
3. Select the passage to change.
4. Add an optional instruction and click “Send rewrite request.”
5. Wait for `writing_draft` to write back the result; use Undo when needed.

## Data and recovery

- Edits are debounced into the current Host process's memory.
- A rewrite request carries the complete current draft in the same XML user message; the UI hides that XML.
- After a restart, the plugin can recover from the latest writing request and successful `writing_draft` results.
- Manual edits that have not travelled with a rewrite request do not survive a Host-process restart.

## Uninstall

```sh
dsh plugin --profile web remove dsh-writing-pad
```

## License

MIT
