---
name: Release
description: This skill should be used when the user asks to "make a release", "create a release", "cut a release", "release a new version", "publish a release", or mentions preparing for release. Provides the workflow for reviewing changes, updating the changelog, bumping the version, verifying, and publishing a GitHub Release.
version: 0.3.0
---

# Release Workflow

Systematic workflow for releasing a new version of `@zhendalf/linear-cli`. The
project is a **Bun-native** package that ships as TypeScript with no build step:
Bun is the package manager, runtime, and test runner; biome handles lint/format.
Publishing is driven by **GitHub Releases** — publishing a release for tag
`v<version>` triggers `.github/workflows/release.yml`, which runs
`npm publish --provenance` via npm OIDC trusted publishing. (The publish job
runs `bun run codegen` first so the gitignored `src/__codegen__` types are
included in the published tarball.)

## When to Use

When preparing to publish a new version. Ensures changes are documented, the
full check suite passes, versions are consistent, and the GitHub Release is
published.

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

## Step 5: Verify (must be green before releasing)

Run the full suite — this mirrors CI and the `just release` recipe:

```bash
bun install --frozen-lockfile
bun run codegen
bunx biome check .
bun x tsc --noEmit
bun test
bun src/main.ts --version   # smoke-run the CLI on Bun
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

## Step 7: Commit and push the release commit

```bash
git add -A
git commit -m "chore: release v$VERSION"
git push origin main
```

The version-bump commit must be on `main` before the release is published, so the
tag the Release creates points at it.

## Step 8: Publish the GitHub Release

Create the release with `gh`. This creates the `v$VERSION` tag (at the pushed
`main` HEAD) and publishes the Release in one step, which is what triggers
publishing:

```bash
# Extract this version's CHANGELOG section as the release notes.
NOTES=$(awk "/^## \[$VERSION\]/{f=1;next} /^## \[/{f=0} f" CHANGELOG.md)
gh release create "v$VERSION" \
  --title "v$VERSION" \
  --notes "$NOTES" \
  --target main
```

Publishing the Release triggers `.github/workflows/release.yml`: a `verify` job
runs the full check suite, then `publish` runs `npm publish --provenance --access
public`. Auth is keyless via npm **OIDC trusted publishing** (no `NPM_TOKEN`
secret) — this must be configured once for `@zhendalf/linear-cli` on npmjs.com
(Trusted Publisher → this repo + `release.yml`). The publish also emits a
provenance attestation.

> Do NOT push a `v*` tag by hand — a bare tag push does not create a Release and
> will not trigger publishing. Always go through `gh release create`.

## Step 9: Verify the publish

- Watch the run: `gh run watch` (or check the Actions tab on GitHub).
- Confirm the new version on npm (`npm view @zhendalf/linear-cli version`).
- `npx @zhendalf/linear-cli@<version> --version` resolves.
- The npm page shows the **Provenance** block linking back to the workflow run.

## Error handling

Stop and report on any failure. Never release with failing checks. If the version
is inconsistent across `package.json` and the plugin manifests, fix it before
creating the Release. If the workflow fails after the Release is published, fix
forward with a new patch version — do not delete/re-tag a published version on
npm.

## Reference

- `justfile` `release` recipe — runs the verify suite and prints the release steps.
- `.github/workflows/release.yml` — the publish pipeline (triggered by a published
  GitHub Release).
- `CHANGELOG.md` — release history.
