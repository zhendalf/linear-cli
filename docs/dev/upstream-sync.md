# upstream sync state

This project began as a Bun/TypeScript port of [schpet/linear-cli](https://github.com/schpet/linear-cli)
(Deno/cliffy). We periodically review upstream for bug fixes and features worth porting.

**This file is the bookmark.** Update `last reviewed` every time upstream is reviewed, so the next
review only has to look at what landed since.

## last reviewed

- **upstream commit:** `5af8286` (past `v2.5.0`)
- **date:** 2026-08-17
- **port baseline:** `fc85b919cdb62a668eecea6ea5484aad9da8f655` (the vendored starting point)

To see what is new since the last review:

```sh
git clone https://github.com/schpet/linear-cli.git /tmp/linear-upstream
git -C /tmp/linear-upstream log --oneline cf349ba..HEAD
```

## ported

From the `fc85b91..cf349ba` range:

- `dc2dca4` + `f5d87b8` — uploads default to private, `--public` opt-in, per-batch validation
- `78f1812` — `issue attach` sidebar-only messaging + inline-image hint (CLI parts)
- `fb8887c` — `issue update --unassign` (and the `IssueUpdateInput` type fix behind it)
- `5214ca9` — `issue update --add-label` / `--remove-label`
- `aad5f2f` — **partial**: only `--clear-cycle`
- `fe6c8b0` — `document list --issue` filter fix
- `3c0a3de` — `document update --project`
- `9756aaf` + `dec4ee5` — document inline-comment guard + comments in `document view --json`
- `701a395` + `27e10af` — `milestone view --all` + truncation surfacing
- `ad630c5` + `43a6290` — `project create` content/priority/label/member/icon/color
- `ad15638` — `project create|update --description-file` + 255-char limit
- `7e84ad9` — `project update --label`
- `b3a41f7` — `team states` + list valid states on wrong `--state`
- `1393c70` — `user list`, `team members --json`, role markers, `includeDisabled` fix
- `7097624` — config suggestions named a nonexistent `linear configure`; added `configure` alias
- `97d6077` (+ `b4013c9` context) — shared sort resolution; error on invalid configured sort
- `eb6f074` — `issue mine` no-team error wording + git-repo hint
- `96f0e04` + `95097b8` — label `id` in `issue view --json`
- `aad5f2f` — **partial**: also the `--search` + `--cycle` silent filter drop

All of the above shipped in **v2.0.0**.

From the `cf349ba..5af8286` range (reviewed 2026-08-17):

- `5af8286` — `issue query`'s "Note: using default team ..." no longer fires when the team came
  from project-scoped config (a project `.linear.toml` or `.env`), only for ambient defaults (a
  shell-exported env var or the global config file). Ported with `getOptionWithSource` /
  `OptionSource` added to `src/config.ts`, `getTeamKeyWithSource` added to `src/utils/linear.ts`,
  and `shouldShowDefaultTeamNote` added to `src/commands/issue/issue-query.ts`, all mirroring
  upstream's `getOptionWithSource` / `OptionSource` / `shouldShowDefaultTeamNote` split.

## pending

Nothing queued. Upstream is at `5af8286` as of this review.

## deferred (large)

Understood and intentionally not ported yet — re-evaluate, don't re-analyze from scratch:

- `aad5f2f` (the rest) — full cycle exposure: `CYC` table column, relative cycle vocabulary
  (`now`/`next`/`+2`), cycle flags in JSON. ~1700 lines upstream; our table renderer differs, so it
  is a re-implementation rather than a port. (`--clear-cycle` and the `--search`/`--cycle` fix are
  already done; what remains is the display work.)
- `9e08748` — `issue create` interactive project selection + `issue_create_ask_project` /
  `issue_create_assign_self` config keys. Our interactive flow was restructured during the port.
- `07e7d4b` — Codex-based eval harness for the skill. Tied to Deno tasks and upstream's frozen
  baselines; would need its own baselines and a logged-in `codex`.
- `928b1eb` — "Support all six document attachment targets in create/update/list/view" (project,
  issue, initiative, team, cycle, release). ~2300 lines: a new shared `attachment-target` module,
  two new resolvers (`resolveInitiativeId`, `resolveReleaseId`), and changes across
  `document-create`/`document-update`/`document-list`/`document-view` plus their tests. Our schema
  already has the prerequisite fields (`cycleId`/`releaseId` on the input types, `ReleaseFilter`,
  `Document.cycle`/`.release`) from the v2.1.0 schema refresh, so this is portable, but it is too
  large and too behavior-changing (e.g. `document list --project` currently only matches slugs;
  this makes it resolve to IDs and error on bad input) to fold into a weekly maintenance run without
  focused review. Worth its own PR.
- `b296fe9` — "sync Linear GraphQL schema" (upstream's schema refresh). Not applicable as a port:
  we refreshed our own vendored `graphql/schema.graphql` independently in v2.1.0 (2026-08-11, same
  day) and already carry the fields this commit exists to add (`cycleId`/`releaseId`,
  `ReleaseFilter`, `Document.cycle`/`.release`).

## not applicable

- `770d5cf` — Linux keyring fix. We have no keyring backend; credentials live in
  `~/.config/linear/credentials.json`.
- `ffb986d` + `82daad7` — upstream's skill-docs generator hardening. Our generator is a separate Bun
  rewrite; the equivalent bugs were fixed directly (alias parsing, abort-before-prune).
