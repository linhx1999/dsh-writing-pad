# Repository Guidelines

## Project Structure & Module Organization

Host code is in `src/`: `index.ts` provides the Remote service/tool; `draft-xml.ts` and `draft-session.ts` own XML/recovery. Browser code lives under `src/client/`, tests under `tests/`, and Remote descriptors in `remote.ts`/`typert.ts`. Treat `dist/` and `*.tgz` as generated.

## Build, Test, and Development Commands

- `pnpm install` installs dependencies under the release-age policy.
- `pnpm build` produces Host, browser, and declaration artifacts in `dist/`.
- `pnpm typecheck` runs strict TypeScript checks without emitting.
- `pnpm test` runs `tests/*.test.ts` with Node's test runner.
- `pnpm pack --dry-run` builds and verifies publishable files.

For an end-to-end check, run `pnpm pack`, install its archive with `dsh plugin --profile web add ./dsh-writing-pad-<version>.tgz`, then start `dsh --profile web`.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, and React function components. Match the existing style: two-space indentation, single quotes, no semicolons, trailing commas in multiline structures, and explicit `.ts`/`.tsx` extensions for relative imports. Use `PascalCase` for components and classes, `camelCase` for functions and variables, and kebab-case CSS class names prefixed with `dsw-`. No formatter or linter is configured; run `pnpm typecheck`.

## Testing Guidelines

Tests use `node:test` and strict assertions. Name files `<module>.test.ts` and cover XML round trips, session replay order, failed tool outcomes, and immutable store snapshots. There is no coverage threshold; behavioral fixes need a regression test.

## Documentation Updates

Keep documentation in the same change as behavior. Update both `README.md` and `README.en.md` whenever user-facing usage, UI, configuration, packaging, or publishing behavior changes. Update `AGENTS.md` whenever developer workflows, code organization, tests, architecture guardrails, or agent instructions change.

## Architecture & Configuration Guardrails

The `details` slot is single-occupant; priority `-10` shadows Harness's priority-`0` tool panel. Blank sessions must reuse the real mounted `details` subtree: the `shell.overlay` bridge may restore its zeroed grid track, but must not render a second floating `WritingPad`. Preserve `assistant(tool_calls) -> tool/result`: never append a synthetic user message during tool execution. Full draft XML travels only with the next real user request. Inspect `pnpm-lock.yaml` before adding exact `minimumReleaseAgeExclude` entries; keep the policy enabled.

## Commit & Pull Request Guidelines

Follow Conventional Commits as shown in history: `feat(writing-pad): ...`, `fix(publish): ...`, `docs: ...`, or `build(deps): ...`. Keep commits narrowly scoped. Pull requests should explain user-visible behavior and architecture impact, list verification commands, link relevant issues, and include screenshots for UI changes. Call out package-version, lockfile, or supply-chain-policy changes explicitly.
