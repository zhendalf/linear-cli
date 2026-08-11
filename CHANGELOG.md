# Changelog

## [Unreleased]

### Added

- `linear team states [teamKey]` lists a team's workflow states (table or `--json`, preserving the GraphQL `nodes` shape).
- `linear user list` (group alias `u`) lists everyone in the workspace, with `--all` and `--json`.
- `linear team members --json` emits the connection shape (`nodes` + `pageInfo`) with GraphQL field names preserved.
- member listings now show `(admin)`, `(owner)`, and `(you)` markers alongside the existing `(inactive)`/`(guest)`/`(not assignable)`, via a shared renderer used by `team members` and `user list`.

### Fixed

- `linear team members --all` was a no-op: `includeDisabled` never reached the API, so disabled users were never fetched and the client-side `active` filter had nothing extra to reveal.
- an unrecognized `--state` on `issue create`/`issue update` now lists the team's valid workflow states and points at `linear team states`, instead of a bare "Workflow state not found".
- `team members` no longer blames the directory name when no team can be resolved — the team key comes from `team_id` in `.linear.toml` (or `LINEAR_TEAM_ID`), never from the directory.

### Changed

- **Bun-native distribution**: the CLI now ships as TypeScript and runs directly on Bun — there is no longer a bundled `dist/main.js`. The published `bin` is `src/main.ts` (`#!/usr/bin/env bun`), and runtime libraries are now real `dependencies`.

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
