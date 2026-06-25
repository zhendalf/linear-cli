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

## toolchain

- **run**: `bun run dev` (runs `src/main.ts` directly) or `bun src/main.ts <args>`
- **build**: `bun run build` → `dist/main.js` (bundled ESM, runs on Node >=20 and Bun)
- **test**: `bun test` (or `bun test --update-snapshots` to regenerate snapshots)
- **typecheck**: `bun x tsc --noEmit`
- **lint/format**: `bunx biome check --write .` (config in `biome.json`)
- **codegen**: `bun run codegen` (must run before typecheck/build if graphql changed)

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

## tests

- tests on commands should mirror the directory structure of the src, e.g.
  - src/commands/issue/issue-view.ts
  - test/commands/issue/issue-view.test.ts
- use `bun test` to run tests, use `bun test --update-snapshots` to update snapshots
- use the NO_COLOR variable for snapshot tests so they don't include ansi escape codes
- new features should get tests
