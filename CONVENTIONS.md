# Conventions

This is a native Node/Bun TypeScript project.

The substantive contributor conventions — toolchain commands, credentials model,
error handling, CLI-flag rules, and test layout — live in [AGENTS.md](AGENTS.md)
(symlinked as `CLAUDE.md`). Read that file before contributing.

Quick reference:

- Package manager + bundler + test runner: **Bun**.
- Lint/format: **biome** (`bunx biome check --write .`).
- Type check: `bun x tsc --noEmit`.
- CLI framework: **commander**. Each command module owns its own name, alias, and
  description; `src/main.ts` only wires them together.
- The published package bundles all deps into `dist/main.js` and declares zero
  runtime dependencies — keep it that way.
