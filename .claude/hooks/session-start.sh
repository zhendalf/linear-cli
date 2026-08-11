#!/bin/bash
# Bootstrap the workspace for Claude Code on the web.
#
# Cloud sessions start from a fresh clone, so two things the repo needs are
# absent: node_modules, and src/__codegen__ (the generated GraphQL types, which
# are gitignored and regenerated on demand). Without both, `bun test` and
# `bun x tsc --noEmit` fail on missing modules/types before any real work
# starts. `bun install` also runs the `prepare` script, which installs the
# lefthook pre-commit/pre-push git hooks.
set -euo pipefail

# Local checkouts are already set up by their owner; only bootstrap the cloud.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Not --frozen-lockfile: the container image is cached after this hook runs, so
# a plain install lets a cached layer be reused across sessions. CI still
# enforces the lockfile.
echo "==> bun install"
bun install

# Must follow install (needs @graphql-codegen) and must precede any typecheck.
echo "==> bun run codegen"
bun run codegen

echo "==> workspace ready"
