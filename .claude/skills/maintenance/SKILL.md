---
name: Maintenance
description: This skill should be used when the user asks to "run maintenance", "do the weekly maintenance", "check for upstream changes", "review the reference project", "upgrade dependencies", or when a scheduled routine invokes periodic project maintenance. Covers dependency upgrades, Linear API changes, and porting valuable changes from the upstream reference project.
version: 0.1.0
---

# Maintenance Workflow

Periodic maintenance for `@zhendalf/linear-cli`, covering three independent areas:

1. **Dependency upgrades**
2. **Linear API changes** that affect us
3. **Upstream reference project** — porting valuable changes from
   [schpet/linear-cli](https://github.com/schpet/linear-cli), the Deno/cliffy project this one was
   ported from

Each area is independent. Do them in any order, skip any that has nothing to do, and **give each its
own branch and PR** so a risky dependency bump never blocks a good bug fix.

## When to Use

On a schedule (a weekly cloud routine invokes this skill), or on demand when someone asks what is
new upstream, whether dependencies are stale, or whether a Linear API change affects us.

## Step 0: Orient and check preconditions

Read `CLAUDE.md` first and follow it exactly. Read `docs/dev/COMMANDS.md` before touching any
command.

```bash
git fetch origin && git status --porcelain && git log --oneline origin/main..HEAD
```

**Stop and report instead of proceeding** if the working tree is dirty or `main` has unpushed
commits — do not stash, reset, or push work that is not yours.

Detect what this environment can do, because it decides which steps are possible at all:

```bash
bun --version; command -v gh && gh auth status; [ -n "$LINEAR_API_KEY$LINEAR_TEST_API_KEY" ] && echo "key present"
```

| capability | if missing |
| --- | --- |
| `bun` | **Stop and report.** No Node build, no `dist/` — do not try to run this under Node. |
| authenticated `gh` | Step 5 falls back to pushing branches instead of opening PRs. |
| a Linear API key | **Step 2 is impossible** — skip it entirely and say so. Steps 1, 3 are unaffected. |

Never go hunting for credentials in config files, and never hard-code or commit a key.

Note that **`bun run codegen` does not need a key or network** — it generates types from the
committed `graphql/schema.graphql`, not from live introspection. It should succeed unconditionally;
if it fails, that is a real problem worth reporting, not an environment limitation.

## Step 1: Dependency upgrades

```bash
bun outdated
```

Upgrade what is safe, in one branch.

- **`graphql` is intentionally pinned to 16.x** — `graphql-request` peer-depends on `14 - 16`. Do
  not bump past 16 unless `graphql-request` has widened that range; if it has, call it out.
- Runtime libraries are real `dependencies` (there is no bundle step, so anything `src/**` imports
  must be installable by consumers). Only build/lint/type tooling and `@types/*` belong in
  `devDependencies`.
- For major bumps, read the changelog and handle breaking changes. If a major needs non-trivial
  migration, **leave it out and note it as a follow-up** rather than half-doing it.

Verify with the green loop (Step 4) before opening the PR.

## Step 2: Linear API changes

**Requires a Linear API key. Without one, skip this step and say so in the report.**

`graphql/schema.graphql` is a committed snapshot, and `codegen.ts` reads *from* it — so running
codegen never discovers anything new. Detecting API drift means re-fetching the live schema and
diffing it:

```bash
LINEAR_API_KEY=$LINEAR_TEST_API_KEY bun src/main.ts schema > /tmp/schema-live.graphql
diff <(sort graphql/schema.graphql) <(sort /tmp/schema-live.graphql) | head -50
```

If the live schema has drifted, update the committed copy, re-run `bun run codegen`, and let
typecheck tell you what broke — `strictScalars` is on, so a newly added scalar fails loudly rather
than silently becoming `unknown`.

Look for, in priority order:

1. **Deprecations of fields we use** — these eventually break us. Fix them.
2. **New fields on entities we already surface** — often a cheap improvement to `--json` output or a
   view.
3. **New capabilities** that map onto existing commands.

Also check [linear.app/changelog](https://linear.app/changelog) and
[linear.app/developers](https://linear.app/developers) for the period since the last run.

New capabilities are *proposals*: implement one only if it is small and clearly useful. Otherwise
write it up in the final report rather than building speculatively.

## Step 3: Review the upstream reference project

**`docs/dev/upstream-sync.md` is the bookmark.** Read it first. It records the last-reviewed
upstream commit, what has been ported, what is pending, what is deliberately deferred (with
reasons), and what does not apply to our stack. It exists so this step stays cheap and so settled
decisions are not re-litigated every week.

```bash
git clone https://github.com/schpet/linear-cli.git /tmp/linear-upstream 2>/dev/null \
  || git -C /tmp/linear-upstream fetch origin
git -C /tmp/linear-upstream log --oneline <last-reviewed>..origin/main
```

> As of upstream v2.5.0 the reference project restructured — it is Deno-only now, with no
> `package.json` (`deno.json`, `mise.toml`, `justfile`). We only ever *read* its diffs, never build
> it, so this does not block anything — but file paths may have moved, so locate code by content
> rather than assuming the old layout.

For each new commit:

1. **Read the actual diff** (`git show <sha>`). Never judge from the subject line — subjects
   routinely understate or misdescribe the change.
2. Decide: do we already have this (independently or partially)? Does it apply to our stack at all?
   Is it worth the effort?
3. Port what is valuable, **prioritizing bug fixes — especially security or data-loss ones — over
   features**.

Then work through the `pending` list in the bookmark; those are already analyzed and ready.

### Adapt, do not transplant

Upstream is Deno + cliffy; we are Bun + commander. Recurring translations:

| upstream | here |
| --- | --- |
| cliffy `Command`, `EnumType` | commander, `.choices()` |
| cliffy `{ collect: true }` | `collect` / `collectEnum` from `src/utils/option-parsers.ts` |
| `Deno.readTextFile` | `node:fs/promises` `readFile` (ENOENT → `NotFoundError`) |
| `Deno.Command` | the subprocess helper in `src/utils/runtime.ts` |
| cliffy prompts | the wrappers in `src/utils/prompt.ts` |
| `@std/cli` Spinner | `createSpinner` from `src/utils/spinner.ts` |
| ad-hoc `throw new Error` | the classes in `src/utils/errors.ts` |
| OS keyring | not applicable — credentials live in `~/.config/linear/credentials.json` |

Preserve port-specific behavior upstream lacks: interactive did-you-mean flows
(`getProjectOptionsByName` + `selectOption`), the global `--workspace` injection
(`addWorkspaceOptionDeep` — never add a command-level `--workspace`), pager support, and the
`--json` connection-shape rules in `CLAUDE.md`.

### Update the bookmark

**In the same PR**, update `docs/dev/upstream-sync.md`: move `last reviewed` forward, move ported
items into `ported`, and record anything newly skipped or deferred *with the reason*. Skipping this
is what makes the next run expensive.

## Step 4: Verify

The full green loop, which mirrors CI:

```bash
bun run codegen && bunx biome check . && bun x tsc --noEmit && bun test && bun src/main.ts --help
```

If `--help` output changed, regenerate snapshots and **eyeball the diff** — an unexpected snapshot
change is a signal, not noise:

```bash
bun test --update-snapshots
```

If flags, command descriptions, or the command surface changed, regenerate the skill docs:

```bash
LINEAR_CLI="bun $(pwd)/src/main.ts" bun run generate-skill-docs
```

> The `LINEAR_CLI` override is **required**. Without it the generator drives whatever `linear` is
> installed globally — a stale published build — and silently produces docs for the wrong version.

If a key is available (Step 0), live-smoke the actual workflow you changed against the throwaway
test workspace. Pass the key via env only:

```bash
LINEAR_API_KEY=$LINEAR_TEST_API_KEY bun src/main.ts <command>
```

`src/main.ts` imports every command, so one broken command breaks the whole CLI — keep typecheck and
the `--help` smoke green.

## Step 5: Deliver

Per concern: branch off current `main`, commit with a conventional-commit message, push, and open a
PR with `gh pr create`.

**If `gh` is unavailable** (it is absent in some environments — check in Step 0), degrade in this
order and state plainly in the report which level you reached:

1. Push the branch and give the compare URL — `https://github.com/zhendalf/linear-cli/compare/<branch>?expand=1`
   — plus the PR title and body you would have used, so a human can open it in one click.
2. If push also fails, leave the commits on local branches, list the branch names, and quote the
   push error.

Never bypass the `pre-push` hook with `--no-verify`; it runs the test suite, and a hook failure is a
real failure, not an obstacle to route around.

- The PR body says what changed, why, which upstream commits it corresponds to (if any), and what
  verification was run.
- Add a `CHANGELOG.md` entry under `## [Unreleased]` using the existing headings (`Security` /
  `Added` / `Fixed` / `Changed` / `Removed`).
- Never commit to `main`, never force-push.
- Do not open empty or trivial PRs.
- If the green loop fails and you cannot fix it, open the PR as a **draft** with the failure output
  quoted in the body. Do not silently drop work, and never report success for something that did not
  pass.

If several unrelated upstream changes are large, split by area (e.g. issue commands vs project
commands) rather than one sprawling PR.

## Step 6: Report

Finish with a short summary:

- PRs opened, with URLs
- What was upgraded
- Which upstream commits were reviewed, and their disposition
- Any Linear API changes that affect us
- Anything needing a human decision

If a category was a no-op, say so in one line — a quiet week is a valid result and worth stating
plainly.
