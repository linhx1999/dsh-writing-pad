# Repository Guidelines

## Project Structure & Module Organization

Host code is in `src/`: `index.ts` provides the Remote service and tool; `draft-xml.ts` and `draft-session.ts` own XML and recovery. Browser components, state, Markdown, and CSS live under `src/client/`; Remote descriptors use `remote.ts` and `typert.ts`. Tests live in `tests/`. Treat `dist/` and `*.tgz` as generated.

## Build, Test, and Development Commands

- `pnpm install` installs dependencies subject to the repository's release-age policy.
- `pnpm build` runs tsdown and produces Host, browser, and declaration artifacts in `dist/`.
- `pnpm typecheck` runs strict TypeScript checking without emitting files.
- `pnpm test` runs all `tests/*.test.ts` files with Node's test runner.
- `pnpm pack --dry-run` builds and verifies the files included in the publishable package.

For an end-to-end check, run `pnpm pack`, install its archive with `dsh plugin --profile web add ./dsh-writing-pad-<version>.tgz`, then start `dsh --profile web`.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, and React function components. Match the existing style: two-space indentation, single quotes, no semicolons, trailing commas in multiline structures, and explicit `.ts`/`.tsx` extensions for relative imports. Use `PascalCase` for components and classes, `camelCase` for functions and variables, and kebab-case CSS class names prefixed with `dsw-`. No formatter or linter is configured; run `pnpm typecheck`.

## Testing Guidelines

Tests use `node:test` and strict assertions. Name files `<module>.test.ts` and cover XML round trips, session replay order, failed tool outcomes, and immutable store snapshots. There is no coverage threshold; behavioral fixes need a regression test.

## Documentation Updates

Keep documentation in the same change as behavior. Update both `README.md` and `README.en.md` whenever user-facing usage, UI, configuration, packaging, or publishing behavior changes. Update `AGENTS.md` whenever developer workflows, code organization, tests, architecture guardrails, or agent instructions change.

## Architecture & Configuration Guardrails

The `details` slot is single-occupant; priority `-10` intentionally shadows Harness's priority-`0` tool panel. Preserve the durable message sequence `assistant(tool_calls) -> tool/result`: never append a synthetic user message during tool execution. Full draft XML travels only with the next real user request. Inspect `pnpm-lock.yaml` before adding exact `minimumReleaseAgeExclude` entries; keep the policy enabled.

## Commit & Pull Request Guidelines

Follow Conventional Commits as shown in history: `feat(writing-pad): ...`, `fix(publish): ...`, `docs: ...`, or `build(deps): ...`. Keep commits narrowly scoped. Pull requests should explain user-visible behavior and architecture impact, list verification commands, link relevant issues, and include screenshots for UI changes. Call out package-version, lockfile, or supply-chain-policy changes explicitly.
