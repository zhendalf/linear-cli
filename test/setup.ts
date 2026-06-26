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
