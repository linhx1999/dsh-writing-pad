# Repository Guidelines

## Project Structure & Module Organization

Host code is in `src/`: `index.ts` provides the Remote/tool, while `draft-xml.ts` and `draft-session.ts` own XML/recovery. Browser code is under `src/client/`, tests under `tests/`, and Remote descriptors in `remote.ts`/`typert.ts`. Treat `dist/` and `*.tgz` as generated.

## Build, Test, and Development Commands

- `pnpm install` installs dependencies under the release-age policy.
- `pnpm build` produces Host, browser, and declaration artifacts in `dist/`.
- `pnpm typecheck` runs strict TypeScript checks without emitting.
- `pnpm test` runs `tests/*.test.ts` with Node's test runner.
- `pnpm pack --dry-run` builds and verifies publishable files.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, and React functions. Follow existing style: two spaces, single quotes, no semicolons, multiline trailing commas, and explicit relative extensions. Use `PascalCase` for components/classes, `camelCase` for code identifiers, and `dsw-`-prefixed kebab-case CSS. There is no formatter or linter; run `pnpm typecheck`.

## Testing Guidelines

Use `node:test`, strict assertions, and `<module>.test.ts` names. Cover XML round trips, replay order, failed tools, and immutable store snapshots. Behavioral fixes need regression tests; no coverage threshold is configured.

## Documentation Updates

Document behavior in the same change. Update both READMEs for user-facing usage, UI, configuration, or installation. Keep build/package/release instructions here; update this file for workflow, organization, tests, architecture, or agent-rule changes.

## Packaging & Release

Release from a clean tree. Synchronize the version in `package.json` and both README install commands. Run `pnpm typecheck`, `pnpm test`, and `pnpm pack --dry-run`; confirm name, version, and files. Use `pnpm pack` for a tarball. For npm, run `npm login`, `pnpm publish --dry-run`, then `pnpm publish --access public`; versions cannot be reused. Verify with `npm view dsh-writing-pad@<version> version`, commit as `chore(release): <version>`, and tag `v<version>`. If release-age policy blocks a fresh version, wait or test its tarball while keeping the policy enabled.

## Architecture & Configuration Guardrails

The single `details` slot uses priority `-10` to shadow Harness's priority-`0` panel. Blank sessions reuse its mounted subtree; `shell.overlay` restores the zeroed track without rendering another `WritingPad`. Preserve `assistant(tool_calls) -> tool/result`: tool execution never appends synthetic user messages. Full draft XML travels with the next real request. Inspect lockfile changes before adding exact `minimumReleaseAgeExclude` entries.

## Commit & Pull Request Guidelines

Use Conventional Commits (`feat(writing-pad): ...`, `fix(publish): ...`, `docs: ...`) and narrow scopes. PRs explain behavior and architecture, list verification, link issues, and include UI screenshots. Call out version, lockfile, or policy changes.
