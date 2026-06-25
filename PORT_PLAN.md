# Port Plan: schpet/linear-cli — Deno → native Node + Bun TypeScript

Authoritative migration plan synthesized from 8 subsystem-mapping reports. This is a **full native rewrite** (no `dnt`): `cliffy → commander`, tokens in a config file via `env-paths` + `LINEAR_API_KEY` override (no keyring FFI), GraphQL/codegen retained, lightweight npm package (no embedded runtime), targets **Node LTS (>=20)** and **Bun**.

---

## 1. Overview & target architecture

- **Runtime:** Node.js LTS (>=20) and Bun, from one ESM build. No Deno, no `deno compile`, no embedded runtime. Distribution is the npm package itself, resolved by `npx linear` / `bunx linear` / global install.
- **Module system:** Native ESM (`"type": "module"`). Forced by top-level await in `src/main.ts`, `src/config.ts`, `src/credentials.ts` and by ESM-only deps (`chalk@5`, `open@10`, `string-width@5+`, `graphql-request@7`). Target `ES2022`, `module`/`moduleResolution` = `bundler` (tsup/esbuild bundles `.ts`-extension imports directly, avoiding a repo-wide extension rewrite).
- **Toolchain:** **Bun** is the package manager (`bun install`, committed `bun.lock`) AND bundler. **Build:** `scripts/build.ts` calls `Bun.build({ target: "node", format: "esm", banner: "#!/usr/bin/env node" })` → single bundled ESM `dist/main.js` (chmod 0755). `package.json` `bin: { "linear": "./dist/main.js" }`, `files: ["dist"]`. `build` script runs codegen first. The bundle targets `node` so the published bin runs on both Node and Bun. (Replaces the original tsup/npm choice; tsup + tsx removed.)
- **Package layout:**
  - `package.json` (metadata, scripts, deps, `bin`, `engines`, `files`), `tsconfig.json`, `scripts/build.ts` (Bun bundler), `biome.json`, and a `bunfig.toml` for `bun test` (added in Phase F) — all NEW. (No `tsup.config.ts`/`vitest.config.ts` — Bun is bundler + test runner.)
  - `src/` keeps its tree: `main.ts`, `config.ts`, `credentials.ts`, `const.ts`, `commands/**`, `utils/**`. **DELETE `src/keyring/`** (all 4 files).
  - New shared shim: `src/utils/runtime.ts` (subprocess, TTY, console-size, ENOENT, platform helpers) to localize the Deno→Node API churn.
  - New vendored renderer: `src/utils/charmd/` (charmd has no npm release).
  - `graphql/schema.graphql` (committed, 731 KB) + `codegen.ts` retained.
  - **DELETE:** `deno.json`, `deno.lock`, `dist-workspace.toml`, `.github/build-setup.yml`, `.github/workflows/publish.yaml`, `.github/workflows/release.yml` (cargo-dist autogen).

---

## 2. Final dependency decision table

Conflicts between subsystem reports are resolved here to a **single choice**. Notable reconciliations are flagged.

| Deno / jsr / npm dependency | Chosen Node package | Rationale |
|---|---|---|
| `jsr:@cliffy/command` | **commander** | Locked decision. Commands/options/args/version/help map cleanly; 86 import sites. |
| `jsr:@cliffy/command/completions` (`CompletionsCommand`) | **drop** (or `@pnpm/tabtab` later) | No commander equivalent; not covered by tests. Confirm with user (open question). |
| `jsr:@cliffy/prompt` | **@inquirer/prompts** | `select/checkbox/input/confirm/password` cover Select/Checkbox/Input/Confirm/Secret; `{name,value}` choice shape matches. |
| `jsr:@cliffy/ansi` | **drop** | 0 source import sites (only the cliffy test harness used it); dies with the harness. |
| `jsr:@cliffy/internal`, `jsr:@cliffy/testing` | **`bun:test`** (custom in-process harness) | Test-only. Rebuilt as commander-in-process capture + `toMatchSnapshot`. |
| `jsr:@std/cli` `unicodeWidth` | **string-width** | De-facto Node equivalent (CJK/emoji aware). ~10 sites for column alignment. |
| `jsr:@std/cli/unstable-spinner` `Spinner` | **ora** | **RECONCILED** (inventory said ora/nanospinner; rendering said ora). Pick `ora`; wrap behind one util since 50+ dynamic-import sites. |
| `jsr:@std/fmt/colors` | **chalk** | **RECONCILED** (graphql/build reports leaned picocolors; rendering/inventory require `rgb24` + `setColorEnabled`). `rgb24` (2 files) → `chalk.hex()`/`chalk.rgb()`, color toggle → `chalk.level`. picocolors lacks both. Pick **chalk** for full parity. |
| `jsr:@std/path` | **node:path** | `join/dirname/basename/extname` 1:1. |
| `jsr:@std/fs` `ensureDir` | **node:fs/promises** `mkdir(...,{recursive:true})` | Trivial, 3 sites. |
| `jsr:@std/encoding` | **node:buffer** `Buffer` | `encodeBase64`/`encodeHex` → `Buffer.from().toString('base64'|'hex')`. |
| `jsr:@std/dotenv` `load` | **dotenv** | Programmatic `parse(readFileSync)`; keep manual `.env` → git-root `.env` + prefix allowlist logic. |
| `jsr:@std/toml` | **smol-toml** | **RECONCILED** (vs `@iarna/toml`). Modern, dual-runtime, parse+stringify. Used for `.linear.toml` (read). Credentials store is **JSON** (resolved), so no TOML write needed there. |
| `jsr:@littletof/charmd` | **VENDOR into `src/utils/charmd/`** | **RECONCILED & DECIDED.** No npm release (404). Vendor its ~6 pure-TS files + repoint its colors import to chalk, preserving the custom `Extension` API that `charmd-hyperlink-extension.ts` depends on. (Alt — remark-based rewrite — loses the Extension hook; rejected.) Highest-risk dep. |
| `jsr:@opensrc/deno-open` | **open** | Locked direction; `open(url, {app:{name}})` API parity is near-exact (deno-open is itself a port of it). |
| `jsr:@std/assert` (test) | **`bun:test` `expect`** | `assertEquals/Rejects/Throws/StringIncludes` → `expect`. |
| `jsr:@std/assert/assertion-error` (NON-test, `src/utils/errors.ts`) | **node:assert** `AssertionError` or local class | One non-test usage; must be preserved as a real class. |
| `jsr:@std/testing` (`FakeTime`/`stub`/`assertSnapshot`) | **`bun:test`** (`setSystemTime`/`spyOn`/`mock`/`toMatchSnapshot`) | Jest-like API; native to Bun. |
| `npm:graphql` | **graphql** (keep) | Already npm. |
| `npm:graphql-request` | **graphql-request** (keep) | Already npm; uses global `fetch`. |
| `npm:@graphql-codegen/cli` | **@graphql-codegen/cli** (devDep, keep) | Invocation → `graphql-codegen --config codegen.ts`. |
| (transitive) client preset | **@graphql-codegen/client-preset** (devDep, ADD) | Was pulled transitively under Deno; make explicit. |
| `npm:@graphql-typed-document-node/core` | keep | Needed by generated/typed-document code. |
| `npm:unified`, `remark-parse`, `remark-stringify`, `remark-gfm`, `unist-util-visit` | keep | Portable ESM; used in `markdown-images.ts` (and base for charmd vendoring if needed). |
| `npm:@types/mdast` (+ bare `mdast` alias) | **@types/mdast** (devDep) | Collapse the bare `mdast` import to `@types/mdast`'s `mdast` module. |
| `npm:valibot` | keep | Config schema validation. |
| `npm:sanitize-filename` | keep | Unchanged. |
| `npm:lefthook` | keep (devDep) | Runtime-agnostic; install via `prepare` script. |
| OS keyring (`src/keyring/*`, FFI/subprocess) | **DELETE** | Locked: tokens go to a 0600 config file. windows.ts (`Deno.dlopen` FFI) is the only `unstable` code in the repo. |
| `env-paths` (NEW) | **env-paths** | Locked: resolves OS config dir for the single credentials file. |
| `deno.json` JSON-module version import | **read `package.json`** | 3 src + 6 test sites. Use `import pkg ... with {type:'json'}` or build-time inject. |
| import map alias `./__generated__/graphql` | **DELETE** | **Correction:** dead — 0 usages in src/test. All generated imports are already relative. No tsconfig path needed. |
| **Build/tooling** | | |
| Deno fmt/lint | **biome** | Single binary, `semicolons: "asNeeded"` matches existing style; ignore `src/__codegen__/`. (Add prettier only if YAML/MD formatting parity is required — open question.) |
| `deno compile` / cargo-dist | **`Bun.build`** (`scripts/build.ts`) + publish | ESM bundle + shebang bin, `target: node`; no native binaries. Bun is PM + bundler. |
| `deno test` | **`bun test`** | Native Bun runner; one process, sequential files (sidesteps env races). Node-runtime parity covered by smoke-testing the built bin under Node in CI. |

**devDependencies:** `typescript`, `@types/node`, `@types/bun` (for `bun:test` + `Bun` globals, added in Phase F), `biome` (`@biomejs/biome`), `@graphql-codegen/cli`, `@graphql-codegen/client-preset`, `@types/mdast`, `lefthook`. (No tsup/tsx/vitest — Bun is the bundler AND test runner and runs TS directly.) `@graphql-typed-document-node/core` is a runtime dep.

**Removed entirely (no Node dep):** all `@std/*` (→ builtins), `@cliffy/internal`, `@cliffy/ansi`, `@cliffy/testing`, all transitive std packages.

---

## 3. Phased execution plan

Phases A→C are mostly sequential foundations; **Phase D batches and Phase E are heavily file-parallelizable** once the shims and the commander shell exist. Phase F (tests) trails the code it verifies. Phase G is cleanup.

### Process improvements (adopted after D1 reflection)
After A/B/C + D1 shipped, three weaknesses were addressed to shift verification left:
1. **Reorder: Phase E (rendering) runs BEFORE D2–D7.** Most list/view commands import `display.ts`/`styling.ts`/`charmd`; porting E first lets every later command batch compile, render, snapshot, and live-smoke as it lands (and front-loads the S1 charmd risk).
2. **Incremental green gate — `tsconfig.ported.json`.** An explicit include-list of ported files (grows each phase) that MUST typecheck with 0 errors (`bun x tsc -p tsconfig.ported.json`). Replaces eyeballing grep'd global tsc output; catches regressions in already-ported code. Converges to the full tree by D7.
3. **Test harness online early (after E), per-batch verification.** Build the `bun:test` in-process commander snapshot harness + `node:http` mock server (the Phase F infra) right after E, then each D batch ships WITH snapshot tests + a read-only live smoke against the test workspace. Phase F becomes "finalize + parity-diff + per-folder-key tests" rather than "build the harness from scratch at the end".

**Revised order:** E → test-infra → D2 → D3 → D4 → D5 → D6 → D7 → F(finalize) → G.

### Phase A — Scaffold & tooling
**Entry:** clean tree on a feature branch.
**Work:** Author `package.json` (name `@zhendalf/linear-cli`, `version` `2.0.0`, `bin: { "linear": "./dist/main.js" }`, `type:module`, `engines`, `files`, scripts), `tsconfig.json` (`bundler` resolution, `allowImportingTsExtensions`, `noEmit`), `tsup.config.ts`, `biome.json`, `vitest.config.ts`. Add all deps from §2. Wire `codegen` script (`graphql-codegen --config codegen.ts` via tsx) and run it so `src/__codegen__/` exists. Update `mise.toml` (deno→node 20 + optional bun). Repoint the 3 `deno.json` version imports to `package.json`. DELETE `deno.json`, `deno.lock`, `dist-workspace.toml`, `.github/build-setup.yml`. Port `skills/linear-cli/scripts/generate-docs.ts` shebang + `@std/path`.
**Exit:** `npm run codegen` succeeds; `tsc --noEmit` parses (errors from un-ported Deno globals expected and tracked); `tsup` produces a `dist/main.js` (need not run yet).

### Phase B — Core runtime/IO + config/credentials + GraphQL foundation
**Entry:** Phase A complete.
**Work (parallelizable by file once `runtime.ts` lands first):**
1. Create `src/utils/runtime.ts`: `runCommand()` (child_process wrapper → `{success, code, stdout, stderr}`), `isStdoutTTY/isStdinTTY/isStderrTTY`, `getConsoleSize()` (**RECONCILED:** use `process.stdout.columns ?? fallback` — no `term-size` dep; rendering report confirms it covers both runtimes and avoids Bun `tput` flakiness), `isNotFoundError(e)` (`e?.code==='ENOENT'`), `isWindows` (`process.platform==='win32'`).
2. Port `src/utils/errors.ts` (no upstream deps): `Deno.env`→`process.env`, `Deno.exit`→`process.exit`, `@std/fmt`→chalk, `@std/assert/assertion-error`→local/`node:assert` `AssertionError`.
3. Port `src/utils/graphql.ts`: `Deno.env`/`isTTY`/version-from-pkg/chalk. Logic (5-step `getResolvedApiKey` precedence) unchanged.
4. **Credentials/config:** add `src/utils/paths.ts` (`env-paths('linear')` shared by both). Rewrite `src/credentials.ts` to a **single inline format** (drop dual-format/migration code), `save()` writes with `{mode:0o600}` + explicit `chmod`. Preserve exported surface (`getCredentialApiKey`, `getDefaultWorkspace`, `getWorkspaces`, `hasWorkspace`, `addCredential`, `removeCredential`, `setDefaultWorkspace`, `loadCredentials`, `getCredentialsPath`). Port `src/config.ts` (smol-toml, dotenv, `execFile` git-root, fs/env swaps; keep valibot schema + `getOption` precedence). **DELETE `src/keyring/`.** Consider an explicit `init()` over module-top `await` to enable in-process tests.
**Exit:** these modules typecheck clean; a manual `node dist`/`tsx src/main.ts auth status` style smoke against the resolver works (commander shell may be stubbed).

### Phase C — cliffy→commander shell + global options
**Entry:** Phase B foundations exist.
**Work:** Port `src/main.ts`: `new Command("linear")`, `.version(pkg.version)`, register the 16 top-level commands via `.addCommand()`, `.parseAsync(process.argv)`. Convert `globalOption(--workspace)`/`globalAction` → a `--workspace` option + `.hook('preAction', ...)` calling `setCliWorkspace`. Establish the **canonical per-command conversion recipe** (documented once, applied in Phase D): strip `:type` suffixes; reorder action signature **args-first then options then command** (cliffy was options-first); `default:`→3rd arg; `collect:true`→accumulator argParser; `required:true`→`.requiredOption`; `hidden`→`new Option().hideHelp()`; `EnumType`→`new Option().choices()`; `:number`→`.argParser(Number)`; `--no-x` is native; parent `this.showHelp()`→`(_o,cmd)=>cmd.help()`. Wire prompt + spinner utils (`@inquirer/prompts`, ora wrapper).
**Exit:** `linear --help` and `linear <group> --help` render; an option-free leaf command (e.g. `auth status`) runs end-to-end.

### Phase D — Port commands in batches
**Entry:** Phase C recipe established. **Batches are independent and parallelizable by directory.**
Each batch = (a) port parent group file + children, (b) apply the action-signature/option recipe, (c) swap remaining `Deno.*` via `runtime.ts`, (d) swap `@opensrc/deno-open`→`open`, prompts, spinner, `%c`/colors.
- **D1 — auth** (8 children): `auth/{auth,auth-login,auth-logout,auth-status,auth-whoami,auth-list,auth-default,auth-token,auth-migrate}.ts`. Remove keyring branches; redesign `auth-login` (drop `--plaintext`/migrate prompt) and `auth-status` (drop storage-mode block); make `auth-migrate` a no-op/delete. Secret→`password`.
- **D2 — issue core** (largest, ~12): `issue/{issue,issue-id,issue-mine,issue-query,issue-create,issue-update,issue-delete,issue-start,issue-title,issue-url,issue-view,issue-describe}.ts`. EnumType (sort/state), `collect`+number coercion, Checkbox prompts (issue-create), `rgb24`→`chalk.hex`.
- **D3 — issue ancillary** (~6): `issue/{issue-commits,issue-pull-request,issue-attach,issue-link,issue-relation,issue-comment,issue-comment-add,issue-comment-list,issue-comment-update,issue-comment-delete,issue-agent-session,issue-agent-session-list,issue-agent-session-view}.ts`. EnumType (agentSessionStatus); `issue-relation` is mixed leaf/parent.
- **D4 — team + project + project-update** : `team/{team,team-list,team-create,team-delete,team-members,team-id,team-autolinks}.ts`, `project/{project,project-list,project-create,project-view,project-update,project-delete}.ts`, `project-update/{project-update,project-update-create,project-update-list}.ts`.
- **D5 — initiative + initiative-update** : `initiative/{initiative,initiative-list,initiative-view,initiative-create,initiative-update,initiative-delete,initiative-archive,initiative-unarchive,initiative-add-project,initiative-remove-project}.ts`, `initiative-update/{initiative-update,initiative-update-create,initiative-update-list}.ts`.
- **D6 — cycle + milestone + label + document** : `cycle/{cycle,cycle-list,cycle-view}.ts`, `milestone/{milestone,milestone-list,milestone-create,milestone-view,milestone-update,milestone-delete}.ts`, `label/{label,label-list,label-create,label-delete}.ts`, `document/{document,document-list,document-create,document-view,document-update,document-delete}.ts`.
- **D7 — top-level leaves** : `commands/api.ts` (only custom `Type`→argParser, framework `ValidationError`→`InvalidArgumentError`, heavy stdin/stdout/fs/exit), `commands/config.ts` (grouped `prompt([...])`, Select `search:true`→`@inquirer/search`), `commands/schema.ts`.
**Exit:** every command file typechecks and `--help` renders; no `Deno.*` or `@cliffy/*`/`@std/*` references remain in `src/commands/`.

### Phase E — Output / rendering / pager / markdown
**Entry:** can run alongside Phase D (shared util files); these utils unblock view commands.
**Work:** Port `src/utils/styling.ts` (chalk shim, central), `hyperlink.ts` (OSC-8, `os.hostname`), `display.ts` (`unicodeWidth`→`string-width`, keep `stripConsoleFormat`), `pager.ts` (child_process spawn + stdin write/end, `process.platform`, `process.stdout.rows`). **Vendor charmd** into `src/utils/charmd/` and repoint `charmd-hyperlink-extension.ts`. Port `markdown-images.ts` (keep remark stack; `os.tmpdir()`, fs/crypto swaps). Introduce `applyConsoleFormat()` to convert the **`%c` CSS-directive `console.log` coloring** (across `initiative-list`, `project-list`, `team-list`, `document-list`, `*-update-list`, `milestone-list`, `label-list`, `auth-list`, plus single-line view files) to chalk.
**Exit:** all 7 `*-view` commands render markdown; list tables show color + alignment; pager pipes through `less`.

### Phase F — Tests
**Entry:** code under test is ported.
**Work:** Runner is **`bun test`** (add `@types/bun` devDep; a `tsconfig`/`bunfig.toml` or test-scoped types so `bun:test` typechecks; bun runs files sequentially in one process, so no pool/thread config needed for env isolation). Port `test/utils/` helpers first: `mock_linear_server.ts` (`Deno.serve`→`node:http.createServer`, keep `LINEAR_GRAPHQL_ENDPOINT` seam), rewrite the cliffy `snapshotTest` harness to **in-process commander capture** (`program.exitOverride()` + `configureOutput()` → buffer → `expect(...).toMatchSnapshot()`; `bun:test` `setSystemTime` replaces the cross-process FakeTime env bridge), `test-helpers.ts` env swaps. Codemod the ~22 pure util/unit tests (`@std/assert`→`expect`, `Deno.test`→`test`/`describe` from `bun:test`, fs/os/process/child_process swaps). Rewrite `credentials.test.ts` against the env-paths JSON-file model (assert 0600, `LINEAR_API_KEY` precedence, **per-folder `api_key` + `workspace=` resolution**, default reassignment); **DELETE `keyring.test.ts` + `keyring.integration.test.ts`**. Regenerate snapshots with `bun test --update-snapshots` (commander help/format differs — do NOT hand-port). Bun writes snapshots to `__snapshots__/*.snap`.
**Exit:** `bun test` green; built bin smoke-tested under Node too (parity).

### Phase G — Build / CI / docs cleanup
**Entry:** code + tests green.
**Work:** Rewrite `.github/workflows/ci.yaml` (setup-bun job: `bun install`→codegen→biome→tsc→`bun test`→`bun run build`→skill-docs; then a setup-node@20 job runs the built bin for Node parity; **remove keyring matrix**). New slim `release.yml` (tag `v*` → setup-bun → `bun install --frozen-lockfile` → codegen → build → publish `--access public`). DELETE cargo-dist `release.yml`, `publish.yaml`. Rewrite `lefthook.yaml` (biome/tsc/`bun test`); install via `prepare`; narrow fmt glob to TS/JSON. Edit `justfile` (drop `dist-generate`, swap deno tasks; drop `svbump ... dist-workspace.toml`). `.gitignore` already updated (`dist`, `node_modules`, `.env*`; keep `src/__codegen__/`). README/release-notes: keyring tokens must be re-entered; homebrew/shell installer removed; install via `bun`/`npx`/`bunx`.
**Exit:** CI green on Node + Bun; publish dry-run (`bun pm pack`) ships only `dist/`; `npx`/`bunx linear` resolves.

---

## 4. Command inventory (tree → batch)

Root `src/main.ts` registers **16** top-level commands. `()` = aliases.

| Top-level | Alias | Type | Children | Batch |
|---|---|---|---|---|
| `auth` | | group | login, logout, status, whoami, list, default, token, migrate | D1 |
| `issue` | `i` | group | id, mine(`list`/`l`), query(`q`), title, start, view, url, describe, commits, pull-request, delete, create, update, comment, attach, link, relation, agent-session | D2/D3 |
| `issue comment` | | nested | add, list, update, delete | D3 |
| `issue agent-session` | | nested | list, view | D3 |
| `team` | `t` | group | list, create, delete, members, id, autolinks | D4 |
| `project` | `p` | group | list, create, view, update, delete | D4 |
| `project-update` | `pu` | group | create, list | D4 |
| `cycle` | `cy` | group | list, view | D6 |
| `milestone` | `m` | group | list, create, view, update, delete | D6 |
| `initiative` | `init` | group | list, view, create, update, delete, archive, unarchive, add-project, remove-project | D5 |
| `initiative-update` | `iu` | group | create, list | D5 |
| `label` | `l` | group | list, create, delete | D6 |
| `document` | | group | list, create, view, update, delete | D6 |
| `completions` | | special | (drop — see open Qs) | C |
| `config` | | leaf | — | D7 |
| `schema` | | leaf | — | D7 |
| `api` | | leaf | — | D7 |

Confirmed in repo: 85 files under `src/commands/**` plus `api.ts`, `config.ts`, `schema.ts` at the `src/commands/` root.

---

## 5. Risk register

Severity: **S1** critical / **S2** high / **S3** medium.

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | **cliffy→commander action-signature reorder** (options-first → args-first) across ~85 actions; a missed reorder passes wrong values with no type error. Plus `collect`/`EnumType`/`:number` lose auto-coercion. | **S1** | One documented recipe (Phase C). Type action params explicitly so a swap is a compile error. Add an `argParser(Number)` checklist for every numeric option (e.g. `--limit`, default 50). Snapshot + smoke each batch. |
| R2 | **charmd has no npm equivalent** (404); custom `Extension` (OSC-8 image hyperlinks) hooks `generateNode`. | **S1** | Vendor charmd's ~6 pure-TS files into `src/utils/charmd/`, repoint its colors import to chalk, carry/replace its shimmed `mdast-util-from-markdown`. Keep the Extension contract so `charmd-hyperlink-extension.ts` is unchanged. Snapshot-test `*-view` output. |
| R3 | **`%c` CSS-directive console coloring** (~11 list files): Node `util.format` silently swallows `%c` → tables compile and run but lose ALL color/underline (no error). | **S1** | `applyConsoleFormat()` helper converting `color:#hex`→`chalk.hex`, `color:gray`→`chalk.gray`, `text-decoration:underline`→`chalk.underline`, honoring `NO_COLOR`/TTY. Visual + snapshot check, since it never throws. |
| R4 | **Snapshot test rewrite**: cliffy `snapshotTest` self-re-execs a child `deno run`; ~98 calls / 41 files, 160 entries. Commander help format differs → ALL help snapshots change. | **S2** | Rewrite harness to in-process commander capture (`exitOverride`+`configureOutput`). Regenerate snapshots with `bun test --update-snapshots`; review content deltas manually (a clean diff is not trustworthy here). |
| R5 | **ESM / top-level-await**: TLA in `main.ts`/`config.ts`/`credentials.ts` + ESM-only deps force `type:module`, `target>=ES2022`, bundler resolution. Side-effect init ordering (config→credentials→commands) must hold. | **S2** | tsup ESM output + shebang. Verify on both runtimes. Optionally convert module-top `await` to explicit `init()` (also helps tests). |
| R6 | **Terminal width semantics**: `Deno.consoleSize()` throws off-TTY; `process.stdout.columns` returns `undefined`. ~20 sites; `isTTY` is `true|undefined` not a method (70+ sites). `unicodeWidth` vs `string-width` can disagree on emoji/CJK → broken alignment. | **S2** | `getConsoleSize()`/`isStdoutTTY()` helpers with `?? fallback`. No `term-size` dep. Snapshot-verify table alignment after the `string-width` swap. |
| R7 | **`process.platform` is `'win32'` not `'windows'`** and `Stats.isFile()` is a method (Deno property) — both silent logic bugs if ported verbatim. | **S2** | `isWindows` const + audit every `Deno.build.os` and `stat().isFile` site (config, credentials, pager, upload). |
| R8 | **`Deno.Command`→child_process** churn (~25 sites, Buffer vs Uint8Array, `.success`/reject-on-nonzero, Web-Streams stdin in pager). | **S2** | Single `runCommand()` helper so files change only their import; pager's `getWriter()` rewritten to `child.stdin.write/end`. |
| R9 | **macOS config-dir relocation**: `env-paths` defaults to `~/Library/Preferences/linear`; current code uses `~/.config/linear`. In-place upgrades won't find the old file. | **S3** | Decide (open Q): override env-paths to keep `~/.config`, or accept relocation + document. New 0600 write mode is a no-op on Windows — guard against throw. |
| R10 | **`src/__codegen__/` is gitignored & absent**; codegen must run before typecheck/build/CI. | **S3** | `codegen` is a prebuild/CI step; schema is committed so it runs offline. |
| R11 | **credentials/keyring tests** used `deno eval` string-subprocess + `_setBackend`; no Node equivalent. | **S3** | Rewrite in-process with `vi.resetModules()` + temp config dir (env seam survives); delete keyring tests with the FFI. |
| R12 | **`Deno.env` race under parallel tests** (set/delete in finally). | **S3** | Largely moot under `bun test` (sequential files, one process); still restore env in `afterEach`. |

---

## 6. Verification strategy

Parity is proven on **both Node (>=20) and Bun** for every layer:

1. **Snapshot parity (primary).** After Phase F, regenerate all `.snap` via `bun test --update-snapshots`, then for each command diff the *new* output against upstream Deno output captured by running the original `deno` CLI on the same fixtures. Help-text deltas are expected (commander format) and reviewed by hand; data-row output should match modulo formatting. Mock GraphQL via the ported `node:http` `MockLinearServer` + `LINEAR_GRAPHQL_ENDPOINT`, with faked clock (`bun:test` `setSystemTime`) and fixed `Date` header for determinism.
2. **`--help` diffing.** Generate `linear … --help` for every command on both the Deno build and the Node build; review the structural diff (commands, options, args, aliases, defaults present) to confirm no option/flag was dropped in the signature reorder. Automate as a script over the command tree.
3. **Live smoke tests against Linear.** With a real `LINEAR_API_KEY`, run a read-only matrix on Node and Bun: `auth status`, `auth whoami`, `issue mine`, `issue view <id>`, `issue query`, `team list`, `project list`, `label list`, `document view`, `api '<graphql>'`, plus a write to a scratch workspace (`issue create`/`comment`) and an interactive prompt path (`auth login`, a delete confirm). Verify pager, OSC-8 hyperlinks, markdown rendering, and spinner visually in a real TTY.
4. **Cross-runtime CI.** `ci.yaml` runs `bun install`→codegen→biome→tsc→`bun test`→`bun run build` under `oven-sh/setup-bun`. A `setup-node@20` job then runs the BUILT bin (`node dist/main.js --version` + a read-only smoke command) to prove Node-runtime parity. `bun pm pack` confirms only `dist/` ships and `npx`/`bunx linear --version` resolves.
5. **Credentials/config behavior.** Dedicated tests assert: 0600 mode on the credentials file, `LINEAR_API_KEY` overrides file, `--workspace` + env conflict error, default reassignment on `removeCredential`, and `.linear.toml` global/project/git-root precedence.

---

## 7. Resolved decisions (locked by user)

1. **Shell completions** — **DROP** the `completions` command in this port; note in release notes. Revisit later if needed.
2. **macOS config dir** — **KEEP `~/.config/linear`** (override `env-paths` default) so in-place upgrades and existing global config TOML keep resolving. New 0600 write guarded to no-op on Windows.
3. **Keyring token migration** — **out of scope**; release-note only (users re-run `linear auth login`). No auto-import of old OS-keyring tokens.
4. **`auth migrate` / `--plaintext`** — **DELETE** `auth migrate`; **DROP** the `--plaintext` flag (clean break for 2.0).
5. **Credentials file format** — **JSON** (`{ "default": "...", "<workspace>": "lin_api_..." }`), written with `{mode:0o600}`. Per-folder `.linear.toml` stays TOML (read via smol-toml). The 5-step `getResolvedApiKey` precedence (incl. per-folder `api_key` and `workspace=` lookup) is **preserved exactly** and explicitly tested in Phase F.
6. **YAML/Markdown formatting** — **narrow** the lefthook fmt glob to TS/JSON; do NOT add prettier.
7. **Toolchain** — **Bun** is package manager + bundler. Committed lockfile is **`bun.lock`**; `scripts/build.ts` uses `Bun.build`. CI installs with `bun install` and still runs tests under both Node and Bun. Phase G publish uses `bun publish` (or `npm publish` — bundle is runtime-agnostic).
8. **Package identity** — name **`@zhendalf/linear-cli`** (user's fork), **version `2.0.0`**, bin **`linear`**. Local-only for now; publish decision deferred.

### PR / review process (locked)
Built in **~13 Codex-reviewed increments**, each a branch merged to `main` only after `codex review` has no high-severity findings: **A, B, C, D1, D2, D3, D4, D5, D6, D7, E, F, G**. Per-phase loop: branch `phase/NN-<name>` → implement → validate (codegen/tsc/build/`bun test` as available) → `codex review` diff vs `main` → address → re-review until clean → merge. Local branches (no GitHub fork yet).
