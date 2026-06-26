#!/usr/bin/env bash
#
# Cloud / Claude-Code-on-the-web setup script.
#
# Point your environment's setup-script field at this file, e.g.:
#
#     bash "$CLAUDE_PROJECT_DIR/scripts/cloud-setup.sh"
#
# It prepares a fresh container so the full verify loop
# (`bunx biome check . && bun x tsc --noEmit && bun test && bun run build`)
# and the release flow work immediately. Safe to run repeatedly (idempotent).
set -euo pipefail

# Run from the repo root regardless of the caller's cwd. A bare `bun install`
# from elsewhere fails with "Bun could not find a package.json file to install
# from", which is the failure this guards against.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
  cd "$CLAUDE_PROJECT_DIR"
else
  cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

# 1. Install JS deps. node_modules is absent in a fresh container, so nothing
#    (tests, biome, tsc, build) runs until this completes. --frozen-lockfile
#    keeps installs reproducible against the committed lockfile.
bun install --frozen-lockfile

# 2. Generate GraphQL types so `tsc`/the editor are green from the start.
#    (build and test regenerate these too; doing it up front avoids spurious
#    type errors before the first build.)
bun run codegen

# 3. Best-effort: install the GitHub CLI so releases can be cut with
#    `gh release create` (publishing a Release triggers
#    .github/workflows/release.yml, which does the keyless OIDC `npm publish`).
#    github.com is reachable from this environment. A failure here must NOT
#    fail setup, so it is isolated and tolerated.
install_gh() {
  command -v gh >/dev/null 2>&1 && return 0
  local ver="2.62.0" tmp bin
  tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/cli/cli/releases/download/v${ver}/gh_${ver}_linux_amd64.tar.gz" \
    | tar -xz -C "$tmp"
  bin="$tmp/gh_${ver}_linux_amd64/bin/gh"
  if [ -w /usr/local/bin ]; then
    install -m 0755 "$bin" /usr/local/bin/gh
  else
    install -D -m 0755 "$bin" "$HOME/.local/bin/gh"
    # Persist PATH for the session if the harness exposes an env file.
    [ -n "${CLAUDE_ENV_FILE:-}" ] && echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
  fi
  rm -rf "$tmp"
}
install_gh || echo "cloud-setup: gh CLI install skipped (non-fatal)" >&2

echo "cloud-setup: ready (deps installed, codegen done)"
