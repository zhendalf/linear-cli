> This file is the contributor guide. It is symlinked as `CLAUDE.md`.

## project layout

- `src/main.ts` — commander entry point; wires up top-level commands
- `src/commands/**` — one directory per command group; each module owns its name/alias/description
- `src/config.ts`, `src/credentials.ts`, `src/const.ts` — config, credentials (JSON store), constants
- `src/utils/**` — shared helpers (errors, paths, runtime shims, formatting)
- `src/__codegen__/`, `graphql/`, `codegen.ts` — generated GraphQL types and schema
- `scripts/build.ts` — Bun bundler that produces `dist/main.js`
- `test/**` — mirrors `src/` (see "tests" below)
- `docs/` — user docs (`authentication.md`, `usage.md`); `docs/dev/` holds the porting plan and **`PORTING-RECIPE.md`** (the canonical recipe for command structure — read it before adding/editing a command)
- `skills/linear-cli/` — the end-user Claude Code plugin skill for *using* the CLI (note: `references/` are stale post-port, see README)
- `.claude/skills/` — dev skills for working *in* this repo (`release`, `add-command`)
- `lefthook.yaml` — git hooks: pre-commit runs biome + `tsc`, pre-push runs `bun test`

## basics

- this is a native Node/Bun TypeScript app (NOT Deno). package manager and bundler are **bun**
- after editing any graphql documents, run `bun run codegen` to get the updated types. after it's updated, `const result = await client.request(query, { teamId });` should work and be typed (and not require explicit types)
- graphql/schema.graphql has the graphql schema document for linear's api
- for diagnostics, use `bun x tsc --noEmit` for type checking and `bunx biome check .` for lint/format
- when coloring or styling terminal text, use **chalk** (not deno's @std/fmt/colors)
- prefer `foo == null` and `foo != null` over `foo === undefined` and `foo !== undefined`
- import: use dynamic import only when necessary, the static form is preferable
- avoid the typescript `any` type - prefer strict typing, if you can't find a good way to fix a type issue (particularly with graphql data or documents) explain the problem instead of working around it
- for `--json` output, preserve GraphQL field names and nesting instead of inventing CLI-specific JSON shapes
- for paginated `--json` output, preserve connection shape and concatenate `nodes` rather than flattening or renaming fields
- **the published package has ZERO runtime dependencies** — everything is bundled into `dist/main.js`, so all libraries are `devDependencies`. Do NOT move/add anything to a `dependencies` block; add new libs with `bun add -d`.
- use the shared wrappers, not the underlying libs directly: prompts → `src/utils/prompt.ts` (`select`/`input`/`confirm`/`password`/`checkbox`/`searchSelect`), spinners → `src/utils/spinner.ts` (`createSpinner`), `%c`-style console coloring → `applyConsoleFormat` from `src/utils/styling.ts`. Reaching for `@inquirer/*`/`ora`/raw `%c` directly is a review smell.

## adding or editing a command

- **read `docs/dev/PORTING-RECIPE.md` first** — it's the canonical recipe (action signature order, `EnumType`→`.choices()`, repeatable/`collect`→`argParser` accumulators via `src/utils/option-parsers.ts`, numeric coercion, prompts, etc.). The `add-command` dev skill in `.claude/skills/` walks the full flow.
- each command MODULE owns its own `name`/`alias`/`description` and exports a configured commander `Command`; register top-level groups in `src/main.ts` via `program.addCommand(...)`, and subcommands in their group file.
- if you add or change a `gql(...)` document, run `bun run codegen` so the generated types update before you typecheck.
- adding/renaming a command or its options changes `--help` output, so snapshots will change — regenerate with `bun test --update-snapshots` and eyeball the diff (a help snapshot that changes in an unexpected way is a signal, not noise).
- new commands/behaviors get tests (see "tests").

## toolchain

- **run**: `bun run dev` (runs `src/main.ts` directly) or `bun src/main.ts <args>`
- **build**: `bun run build` → `dist/main.js` (bundled ESM, runs on Node >=20 and Bun)
- **test**: `bun test` (or `bun test --update-snapshots` to regenerate snapshots)
- **typecheck**: `bun x tsc --noEmit`
- **lint/format**: `bunx biome check --write .` (config in `biome.json`)
- **codegen**: `bun run codegen` (must run before typecheck/build if graphql changed)

## verifying changes

- the full green loop before you consider a change done (mirrors CI):
  ```sh
  bun run codegen && bunx biome check . && bun x tsc --noEmit && bun test && bun run build
  ```
- **live-smoke real behavior** against a throwaway Linear workspace, not just unit tests: `LINEAR_API_KEY=<test-key> bun src/main.ts <command>` (or run the built `node dist/main.js`). Exercise the actual workflow you changed. **Never hard-code or commit an API key** — pass it via the env var only.
- the CLI runs on Node ≥20 AND Bun; for parity, smoke the built bin under Node (`node dist/main.js …`), not only via `bun`.
- the bin must build before it runs end-to-end (`src/main.ts` imports every command), so a single broken command fails the whole CLI — keep the build green.

## credentials

- API tokens live in `~/.config/linear/credentials.json` (0600), NOT in the OS keyring
- `LINEAR_API_KEY` env var overrides the credentials file
- per-folder `.linear.toml` can set `api_key` and `workspace` (read via smol-toml)

## error handling

- never fail silently - if something goes wrong or a lookup fails, throw an error with a helpful message
- when user-provided input (flags, args) doesn't match expected values, error immediately with guidance on how to fix it
- avoid falling back to defaults when explicit user input is invalid; explicit input should either work or error
- use custom error classes from src/utils/errors.ts:
  - `ValidationError(message, { suggestion })` for bad input
  - `NotFoundError(entityType, identifier)` for missing entities
  - `AuthError(message)` for auth issues
  - `CliError(userMessage, { suggestion, cause })` for others
- wrap command actions in try-catch with `handleError(error, "Failed to <action>")`
- errors display clean messages to stderr with ✗ prefix, stack traces only shown when `LINEAR_DEBUG=1`

## cli flags

- never use the same short flag alias (e.g. `-w`) on both a global option and a command-level option — commander resolves global options first, so the command-level alias will be shadowed
- before adding a short flag, grep the codebase for that letter to ensure it's not already in use at a conflicting scope
- `--workspace <slug>` is a global credential selector injected onto every command (`addWorkspaceOptionDeep` in `src/main.ts`). Do NOT add a command-level `--workspace` — it collides with the global one; pick a different flag name for a command-specific workspace concept.
- standardize destructive-action confirmation on `-y, --yes` (keep any legacy `--force`/`--confirm` as `.hideHelp()` aliases for back-compat).

## tests

- tests on commands should mirror the directory structure of the src, e.g.
  - src/commands/issue/issue-view.ts
  - test/commands/issue/issue-view.test.ts
- use `bun test` to run tests, use `bun test --update-snapshots` to update snapshots
- use the NO_COLOR variable for snapshot tests so they don't include ansi escape codes
- new features should get tests
