import { expect, test } from "bun:test"
import { getConsoleSize, isStdinTTY, isStdoutTTY } from "../../src/utils/runtime.ts"
import { captureOutput } from "./snapshot_with_fake_time.ts"

// Regression guard: the snapshot harness must pin a deterministic, non-TTY
// environment while capturing command output. Otherwise table-width and
// interactivity-dependent output would differ between a piped run (CI) and an
// interactive terminal of an arbitrary width, making snapshots fail only for
// some users.
//
// `isTTY`/`columns` are getter-only on real terminal streams, so we simulate a
// terminal with defineProperty (plain assignment throws "readonly").
function overrideProp(obj: object, prop: string, value: unknown): () => void {
  const orig = Object.getOwnPropertyDescriptor(obj, prop)
  Object.defineProperty(obj, prop, { value, configurable: true, writable: true, enumerable: true })
  return () => {
    if (orig) Object.defineProperty(obj, prop, orig)
    else delete (obj as Record<string, unknown>)[prop]
  }
}

test("captureOutput pins a non-TTY, fixed-width environment regardless of the host terminal", async () => {
  // Simulate an interactive terminal of a specific (narrow) width.
  const restore = [
    overrideProp(process.stdout, "isTTY", true),
    overrideProp(process.stdout, "columns", 50),
    overrideProp(process.stdin, "isTTY", true),
  ]

  try {
    let seen: { tty: boolean; stdinTty: boolean; cols: number } | undefined
    await captureOutput(() => {
      seen = {
        tty: isStdoutTTY(),
        stdinTty: isStdinTTY(),
        cols: getConsoleSize().columns,
      }
    })

    // During capture the host terminal must not leak in.
    expect(seen?.tty).toBe(false)
    expect(seen?.stdinTty).toBe(false)
    expect(seen?.cols).toBe(80) // getConsoleSize fallback, not the host's 50

    // ...and the simulated terminal is restored afterwards.
    expect(process.stdout.isTTY).toBe(true)
    expect(process.stdout.columns).toBe(50)
    expect(process.stdin.isTTY).toBe(true)
  } finally {
    for (const r of restore) r()
  }
})
