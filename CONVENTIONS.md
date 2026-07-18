# Conventions

This is a Bun-native TypeScript project — no build step; the CLI ships as
TypeScript and runs directly on Bun.

The substantive contributor conventions — toolchain commands, credentials model,
error handling, CLI-flag rules, and test layout — live in [AGENTS.md](AGENTS.md)
(symlinked as `CLAUDE.md`). Read that file before contributing.

Quick reference:

- Package manager + runtime + test runner: **Bun**.
- Lint/format: **biome** (`bunx biome check --write .`).
- Type check: `bun x tsc --noEmit`.
- CLI framework: **commander**. Each command module owns its own name, alias, and
  description; `src/main.ts` only wires them together.
- The package ships TypeScript source and runs directly on Bun (no bundle).
  Runtime libraries are real `dependencies`; only tooling is a `devDependency`.
