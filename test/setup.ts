// Global test setup (loaded via bunfig.toml `[test] preload`).
//
// Pins a deterministic, terminal-independent environment so assertions don't
// depend on the host terminal's color support, width, or TTY state. Without
// this, tests pass when run piped (CI) but fail in an interactive terminal:
//   - chalk emits ANSI color (it detects color support once, at import time),
//     breaking tests that assert exact uncolored output;
//   - commands size tables off process.stdout.isTTY/.columns and gate
//     interactivity off process.stdin.isTTY, so output (and prompting) differs.

import chalk from "chalk"

// Refuse to run with an inherited git environment. Git exports GIT_DIR,
// GIT_INDEX_FILE and friends to the hooks it runs, and GIT_DIR overrides a
// child process's cwd — so `bun test` invoked straight from a git hook makes
// the fixtures in test/utils/{git,vcs}.test.ts run their `git init`/`commit`/
// `checkout -b` against THIS repository instead of their temp directories,
// committing fixture files and creating fixture branches in it.
//
// This has to be fatal rather than self-healing: Bun cannot drop an inherited
// variable from inside the process (`delete process.env.X` hides it from JS,
// but spawned children still inherit the original value), so a scrub here
// would look safe while the damage still happened. lefthook's pre-push hook
// strips these before invoking bun; see lefthook.yaml.
const REPO_REDIRECTING_GIT_VARS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_QUARANTINE_PATH",
  "GIT_PREFIX",
]
const inheritedGitVars = REPO_REDIRECTING_GIT_VARS.filter((name) => process.env[name])
if (inheritedGitVars.length > 0) {
  throw new Error(
    `Refusing to run tests with an inherited git environment (${inheritedGitVars.join(", ")}). ` +
      "These point git at this repository regardless of a child process's cwd, so the git " +
      "fixtures would commit to it. Unset them and re-run, e.g. " +
      `\`env ${inheritedGitVars.map((name) => `-u ${name}`).join(" ")} bun test\`.`,
  )
}

// Disable color explicitly so it sticks even under FORCE_COLOR or a TTY, where
// chalk would otherwise enable it. chalk re-reads `.level` on every call, so
// setting it here affects all later renders through the shared instance.
chalk.level = 0

// Force a non-TTY, fixed-width environment. isTTY/columns are getter-only on
// real terminal streams (plain assignment throws "readonly"), so use
// defineProperty.
const pin = (obj: object, prop: string, value: unknown): void => {
  Object.defineProperty(obj, prop, { value, configurable: true, writable: true, enumerable: true })
}
pin(process.stdout, "isTTY", false)
pin(process.stderr, "isTTY", false)
pin(process.stdin, "isTTY", false)
pin(process.stdout, "columns", undefined)
pin(process.stdout, "rows", undefined)
