# Changelog

## [Unreleased]

## [2.1.0] - 2026-08-11

### Changed

- refreshed the vendored `graphql/schema.graphql` from the live Linear API — it had not been updated since the port baseline. Generated types, typecheck, and the test suite are unaffected. Surfaced two deprecations we still query on `AgentSession`: `externalLink` (migrate to `externalLinks`; note the intermediate `externalUrls` is also deprecated) and `type` ("slated for removal").
- `issue agent-session view` now queries the deprecated `AgentSession.externalLink` as `externalLinks { label url }` (skipping the intermediate, also-deprecated `externalUrls`). The human-readable output replaces the single `**External Link:** <url>` line with an `## External Links` section listing each `label`/`url`, and is omitted entirely when there are none. **`--json` shape change:** the top-level `externalLink` string is replaced by an `externalLinks` array of `{ label, url }` objects, preserving the GraphQL field names and nesting.
- dropped the deprecated `AgentSession.type` from the `issue agent-session view` and `issue agent-session list` selection sets. The enum has a single value (`commentThread`) and no replacement field in the schema, so `view` no longer prints a `**Type:**` line and `type` no longer appears in either command's `--json` output.


## [2.0.0] - 2026-08-11

### Security

- **attachments are no longer public by default**: `issue attach` and `issue comment add --attach` previously auto-published raster images to `public.linear.app`, where anyone with the URL could read them without authenticating. Uploads now default to workspace-only (matching the Linear web app), with an explicit `--public` opt-in that warns when it is used. Requesting `--public` for a non-image type is an error rather than a silent downgrade, and mixed batches are validated before any file is uploaded.

### Added

- `linear team states [teamKey]` lists a team's workflow states (table or `--json`, preserving the GraphQL `nodes` shape)
- `linear user list` (group alias `u`) lists everyone in the workspace, with `--all` and `--json`
- `linear team members --json` emits the connection shape (`nodes` + `pageInfo`) with GraphQL field names preserved
- member listings now show `(admin)`, `(owner)`, and `(you)` markers alongside the existing `(inactive)`/`(guest)`/`(not assignable)`, via a shared renderer used by `team members` and `user list`
- `issue update --unassign` to clear an assignee, and `--clear-cycle` to clear a cycle
- `issue update --add-label` / `--remove-label` for incremental label edits (`--label` still replaces the whole set, which its help text now says explicitly)
- `document update --project` to re-point a document at another project
- `document view --json` now includes the document's comments as a paginated connection
- `milestone view --all` to list every attached issue; without it, the view now says when a milestone has more issues than were fetched instead of silently truncating
- `project create` gains `--content`/`--content-file` (long-form overview), `--priority`, `--label`, `--member`, `--icon`, and `--color`
- `project create`/`project update` gain `-f, --description-file`, and `--description` now documents Linear's 255-character limit
- `project update --label` (replace semantics, deduplicated, excludes label groups)

### Fixed

- `linear team members --all` was a no-op: `includeDisabled` never reached the API, so disabled users were never fetched and the client-side `active` filter had nothing extra to reveal
- an unrecognized `--state` on `issue create`/`issue update` now lists the team's valid workflow states and points at `linear team states`, instead of a bare "Workflow state not found"
- `document list --issue` never worked — the filter used a nonexistent `identifier` comparator, so every invocation was rejected by the API. It now filters on `issue.id`, which accepts human identifiers like `ENG-123`.
- `document update` now refuses to overwrite a document that has active inline comments (which a Markdown replacement would orphan), with `--force` to override
- the skill-docs generator silently deleted the reference docs for every aliased command group: it parsed the command list expecting `command, alias` but commander emits `command|alias`, and it pruned stale files before rendering. It now parses aliases correctly and aborts rather than pruning when discovery comes up empty. It also reads each command's description from commander's post-`Usage:` paragraph instead of cliffy's `Description:` section, so descriptions are no longer blank.
- an invalid `issue_sort` (from `--sort`, `LINEAR_ISSUE_SORT`, or `.linear.toml`) now errors and lists the valid values instead of silently sorting by priority. Sort resolution moved into one shared `resolveIssueSort()` — `--sort` flag > `LINEAR_ISSUE_SORT` > `issue_sort` config > `priority`.
- `issue query --search --cycle` no longer drops the cycle filter: the resolved cycle id is threaded into the search request.
- `issue view --json` now includes each label's `id` alongside `name` and `color`.
- suggestions that told users to run `linear configure` now name the real `linear config` command (`team id`, `team autolinks`, and the "an integer id was provided, but no team is set" error, which is now a `ValidationError` with the standard ✗ + suggestion treatment).

### Changed

- `linear config` accepts `configure` as an alias.
- errors for a missing team no longer claim the team can come from the directory name (it only ever comes from `--team`, `LINEAR_TEAM_ID`, or `team_id` config). `issue mine`, `cycle list`, `cycle view`, `team id`, `team autolinks`, and `team members` now say "No default team configured and no team scope provided" and, inside a git work tree, point at `linear config`.
- **Bun-native distribution**: the CLI now ships as TypeScript and runs directly on Bun — there is no longer a bundled `dist/main.js`. The published `bin` is `src/main.ts` (`#!/usr/bin/env bun`), and runtime libraries are now real `dependencies`.
- all dependencies updated to current majors: commander 15, @inquirer/prompts 8, chalk 6, ora 9, dotenv 17, open 11, env-paths 4, string-width 8; dev tooling moves to Biome 2, graphql-codegen 7, lefthook 2, TypeScript 7. `graphql` intentionally stays on 16.x (graphql-request peer-depends on `14 - 16`). Linear's custom scalars are now explicitly mapped in `codegen.ts` (`strictScalars`), since codegen ≥ 6 types unmapped scalars as `unknown`.

### Removed

- the bundling/build step (`scripts/build.ts`, `bun run build`) and the Node-runtime distribution. **Bun is now required** to install and run the CLI.


## [1.0.1] - 2026-06-26

### Changed

- issue view now orders comment threads chronologically (oldest first), matching Linear's UI


## [1.0.0] - 2026-06-26

The 1.x line distributes the CLI as a standard npm package (`@zhendalf/linear-cli`) that runs on Node.js (>=20) and Bun from a single bundled `dist/main.js`.

### Highlights

- **distribution**: install via `bun add -g @zhendalf/linear-cli`, `npm i -g @zhendalf/linear-cli`, `bunx @zhendalf/linear-cli`, or `npx @zhendalf/linear-cli`.
- **token storage**: API keys are stored in `~/.config/linear/credentials.json` (0600 permissions); `LINEAR_API_KEY` overrides the file, and a per-folder `.linear.toml` can set `api_key`/`workspace`.
- **multi-workspace auth**: `auth login`, `list`, `status`, `default`, `logout`, `whoami`, and `token` manage one or more workspaces and resolve the active one per directory.
- **toolchain**: Bun is the package manager and bundler; biome handles lint/format and `tsc --noEmit` type-checks.

## Earlier history

The command surface grew over a long series of releases. Notable milestones:

### Issues

- `issue mine` (personal work queue) and `issue query` (cross-team filtering, `--json`, full-text `--search`)
- `issue view` with assignee/priority/state, parent and sub-issues, comment threads (chronological), attachments, and local image download
- `issue create`/`update` with project, milestone, cycle, parent, assignee, and label support
- `issue start` (git branch or jj `Linear-issue` trailer), `issue pr` (via `gh`), `issue delete` (with `--bulk`)
- `issue comment` add/update/list/delete, `issue relation`, `issue link`, `issue attach`, `issue commits` (jj)

### Teams, projects, cycles, milestones, documents

- `team` list/id/members/create/delete and GitHub autolinks
- `project` list/view/create/update/delete (`--json` output on list and create)
- `cycle` list/view and `--cycle` filtering
- `milestone` list/view/create/update/delete
- `document` list/view/create/update/delete
- `initiative` and `label` management commands

### Configuration and output

- `.linear.toml` project config plus global user config; environment variables override both
- `--json` output that preserves GraphQL field names and connection shape
- raw GraphQL access via the `api` command and `schema` (SDL or JSON)
- pager support and OSC-8 hyperlinks for issue output
- friendly error handling with `LINEAR_DEBUG` for troubleshooting
