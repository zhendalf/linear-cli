---
name: Release
description: This skill should be used when the user asks to "make a release", "create a release", "cut a release", "release a new version", "publish a release", or mentions preparing for release. Provides the workflow for reviewing changes, updating the changelog, bumping the version, verifying, and tagging.
version: 0.2.0
---

# Release Workflow

Systematic workflow for releasing a new version of `@zhendalf/linear-cli`. The
project is a native **Node/Bun** package: Bun is the package manager, bundler,
and test runner; biome handles lint/format. Publishing is driven by a git tag —
pushing `v<version>` triggers `.github/workflows/release.yml`, which runs
`bun publish`.

## When to Use

When preparing to publish a new version. Ensures changes are documented, the
full check suite passes, versions are consistent, and the tag is created.

## Step 1: Review changes since the last release

```bash
git log --oneline "$(git describe --tags --abbrev=0 2>/dev/null)"..HEAD
```

(If there are no tags yet, review `git log --oneline` from the start.)

## Step 2: Update CHANGELOG.md

For each user-facing change, add an entry under an `[Unreleased]` section
following Keep a Changelog categories (`Added`, `Changed`, `Deprecated`,
`Removed`, `Fixed`, `Security`). Exclude internal refactors, docs-only, and
build/CI chores unless significant. Edit `CHANGELOG.md` directly.

## Step 3: Confirm the changelog with the user

Show the `[Unreleased]` section and ask the user to review before proceeding.

## Step 4: Determine the semver bump

- **Major** — breaking changes, removed features.
- **Minor** — new backward-compatible features, deprecations.
- **Patch** — bug fixes, security fixes, minor improvements.

Recommend a bump with reasoning, show current → proposed version, and wait for
confirmation.

## Step 5: Verify (must be green before tagging)

Run the full suite — this mirrors CI and the `just tag` recipe:

```bash
bun install --frozen-lockfile
bun run codegen
bunx biome check .
bun x tsc --noEmit
bun test
bun run build
node dist/main.js --version   # Node-runtime parity check
```

Do NOT proceed if anything fails.

> Note: `bun run generate-skill-docs` is intentionally NOT part of the release
> flow. Run it manually when command help text changes.

## Step 6: Bump the version

Update the version in **package.json** and the two Claude-plugin manifests so
they stay in sync:

```bash
VERSION="<new-version>"   # e.g. 2.1.0
npm pkg set version="$VERSION"                                  # package.json
# .claude-plugin/plugin.json and marketplace.json (edit or use jq):
tmp=$(mktemp); jq --arg v "$VERSION" '.version=$v' .claude-plugin/plugin.json > "$tmp" && mv "$tmp" .claude-plugin/plugin.json
# marketplace.json has a top-level version AND plugins[].version — update both:
tmp=$(mktemp); jq --arg v "$VERSION" '.version=$v | (.plugins[]? |= (.version=$v))' .claude-plugin/marketplace.json > "$tmp" && mv "$tmp" .claude-plugin/marketplace.json
```

Re-run `bunx biome format --write package.json` if needed so formatting stays clean.

## Step 7: Commit, tag, push

```bash
git add -A
git commit -m "chore: release v$VERSION"
git tag "v$VERSION"
git push origin main --tags
```

Pushing the tag triggers `.github/workflows/release.yml` → `bun publish --access
public` (auth via the `NPM_TOKEN` repo secret, mapped to `NPM_CONFIG_TOKEN`).

## Step 8: Verify the publish

- Confirm the tag and the Release workflow run on GitHub.
- Confirm the new version on npm (`npm view @zhendalf/linear-cli version`).
- `npx @zhendalf/linear-cli@<version> --version` resolves.

## Error handling

Stop and report on any failure. Never tag/publish with failing checks. If the
version is inconsistent across `package.json` and the plugin manifests, fix it
before tagging.

## Reference

- `justfile` `tag` recipe — runs the verify suite and prints the manual tag steps.
- `.github/workflows/release.yml` — the publish pipeline.
- `CHANGELOG.md` — release history.
