/**
 * In-process snapshot test harness for commander-based commands.
 * Runs the command in-process (no subprocess) and snapshots its output.
 *
 * Usage:
 *   await snapshotTest({
 *     name: "My Command - Help",
 *     meta: import.meta,
 *     args: ["--help"],
 *     colors: false,
 *     fn: async () => {
 *       await myCommand.parseAsync(["--help"], { from: "user" })
 *     }
 *   })
 */

import { expect, setSystemTime, test } from "bun:test"

// Mutex to serialize snapshot tests - they modify process globals (argv, env, stdout)
// and must not run concurrently even when bun:test runs tests in parallel
let snapshotMutex: Promise<void> = Promise.resolve()

function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const result = snapshotMutex.then(fn)
  // Allow errors to propagate to caller but not block subsequent tests
  snapshotMutex = result.then(
    () => {},
    () => {},
  )
  return result
}

export interface SnapshotTestStep {
  stdin?: Array<string> | string
  args?: Array<string>
  canFail?: true
}

export interface SnapshotTestWithFakeTimeOptions extends SnapshotTestStep {
  name: string
  meta: ImportMeta
  fn(): void | Promise<void>
  steps?: Record<string, SnapshotTestStep>
  denoArgs?: Array<string>
  dir?: string
  path?: string
  osSuffix?: Array<string>
  colors?: boolean
  timeout?: number
  ignore?: boolean
  only?: boolean
  serializer?: (actual: string) => string
  fakeTime?: string | number | Date
  canFail?: true
}

// ANSI escape sequence pattern for stripping colors
const ANSI_PATTERN = /\x1b\[[0-9;]*[mGKHFABCDEFGHIJKnsuhl]/g

function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, "")
}

/**
 * Capture stdout and stderr output from a function call.
 * Temporarily replaces process.stdout.write and process.stderr.write.
 */
/**
 * Sentinel thrown by our process.exit mock so we can distinguish a
 * (suppressible) process.exit() call from a genuine thrown error.
 */
class ProcessExitSignal extends Error {
  constructor(public exitCode: number | string | null | undefined) {
    super(`process.exit(${exitCode})`)
    this.name = "ProcessExitSignal"
  }
}

/**
 * Decide whether a caught error is commander/exit control-flow that should be
 * captured-and-continued, vs. a genuine failure that must propagate so the
 * test goes red.
 *
 * Control-flow (suppressible):
 *  - our ProcessExitSignal (from a mocked process.exit, e.g. --help/--version)
 *  - commander's CommanderError / exitOverride errors (help/version/known exits)
 *
 * Everything else (assertion failures, mock/server errors, unexpected throws)
 * is rethrown.
 */
function isControlFlowExit(err: unknown): boolean {
  if (err instanceof ProcessExitSignal) {
    return true
  }
  if (err && typeof err === "object") {
    const e = err as {
      name?: string
      code?: string
      constructor?: { name?: string }
    }
    // commander.CommanderError instances carry a `code` like
    // "commander.helpDisplayed" / "commander.version" / "commander.help".
    if (typeof e.code === "string" && e.code.startsWith("commander.")) {
      return true
    }
    if (e.name === "CommanderError" || e.constructor?.name === "CommanderError") {
      return true
    }
  }
  return false
}

export async function captureOutput(
  fn: () => void | Promise<void>,
  options?: { canFail?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  let stdoutBuf = ""
  let stderrBuf = ""

  const origStdoutWrite = process.stdout.write.bind(process.stdout)
  const origStderrWrite = process.stderr.write.bind(process.stderr)

  const origConsoleLog = console.log
  const origConsoleError = console.error
  const origConsoleWarn = console.warn
  const origExit = process.exit

  // Pin a deterministic non-TTY environment for the duration of the capture.
  // Commands size tables off `isStdoutTTY()`/`getConsoleSize()` (i.e.
  // `process.stdout.isTTY`/`.columns`) and gate interactivity/spinners off TTY
  // state. Without pinning, snapshots only match when run piped (isTTY=undefined,
  // the fixed fallback width); in an interactive terminal the real isTTY/width
  // leaks in and table-width snapshots fail. Force the piped behaviour here.
  // `isTTY`/`columns` are getter-only on real terminal streams (plain assignment
  // throws "readonly"), so override via defineProperty and restore exactly.
  const restorePins: Array<() => void> = []
  const pinProp = (obj: object, prop: string, value: unknown) => {
    const orig = Object.getOwnPropertyDescriptor(obj, prop)
    Object.defineProperty(obj, prop, {
      value,
      configurable: true,
      writable: true,
      enumerable: true,
    })
    restorePins.push(() => {
      if (orig) Object.defineProperty(obj, prop, orig)
      else delete (obj as Record<string, unknown>)[prop]
    })
  }
  pinProp(process.stdout, "isTTY", false)
  pinProp(process.stderr, "isTTY", false)
  pinProp(process.stdin, "isTTY", false)
  pinProp(process.stdout, "columns", undefined)
  pinProp(process.stdout, "rows", undefined)

  process.stdout.write = (chunk: string | Uint8Array, ...args: unknown[]) => {
    stdoutBuf += typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString()
    return true
  }

  process.stderr.write = (chunk: string | Uint8Array, ...args: unknown[]) => {
    stderrBuf += typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString()
    return true
  }

  console.log = (...args: unknown[]) => {
    stdoutBuf += args.map(String).join(" ") + "\n"
  }

  console.error = (...args: unknown[]) => {
    stderrBuf += args.map(String).join(" ") + "\n"
  }

  console.warn = (...args: unknown[]) => {
    stderrBuf += args.map(String).join(" ") + "\n"
  }

  // Mock process.exit so commander --help and error exits don't kill the test process
  process.exit = ((code: number | string | null | undefined) => {
    throw new ProcessExitSignal(code)
  }) as typeof process.exit

  let caught: unknown
  let didThrow = false
  try {
    await fn()
  } catch (err) {
    caught = err
    didThrow = true
  } finally {
    process.stdout.write = origStdoutWrite
    process.stderr.write = origStderrWrite
    console.log = origConsoleLog
    console.error = origConsoleError
    console.warn = origConsoleWarn
    process.exit = origExit
    for (const restore of restorePins) restore()
  }

  // Only suppress commander control-flow exits (help/version/normal exit).
  // A genuine assertion/mock/action failure MUST propagate so the test fails,
  // unless the test explicitly opted into `canFail`.
  if (didThrow && !options?.canFail && !isControlFlowExit(caught)) {
    throw caught
  }

  return { stdout: stdoutBuf, stderr: stderrBuf }
}

/**
 * Register a snapshot test using bun:test. Runs the command in-process.
 */
export async function snapshotTest(options: SnapshotTestWithFakeTimeOptions): Promise<void> {
  const {
    name,
    fn,
    fakeTime,
    colors = false,
    ignore = false,
    only = false,
    canFail = false,
  } = options

  const testFn = only ? test.only : ignore ? test.skip : test

  testFn(name, () =>
    withMutex(async () => {
      // Set up fake time if requested
      if (fakeTime != null) {
        const fakeTimeValue =
          fakeTime instanceof Date
            ? fakeTime
            : new Date(typeof fakeTime === "number" ? fakeTime : fakeTime)
        setSystemTime(fakeTimeValue)
      }

      // Disable colors for snapshot tests unless explicitly enabled
      const chalk = (await import("chalk")).default
      const origChalkLevel = chalk.level
      if (!colors) {
        chalk.level = 0
      }

      // Set process.argv so commander's .parse() (without args) reads the test args
      const origArgv = process.argv
      const testArgs = options.args ?? []
      process.argv = ["node", "test-file.ts", ...testArgs]

      try {
        const { stdout, stderr } = await captureOutput(fn, { canFail })
        const cleanStdout = colors ? stdout : stripAnsi(stdout)
        const cleanStderr = colors ? stderr : stripAnsi(stderr)

        // Combine stdout + stderr into a single snapshot string
        const output = `stdout:\n"${cleanStdout}"\nstderr:\n"${cleanStderr}"`

        expect(output).toMatchSnapshot()
      } finally {
        process.argv = origArgv
        // Restore fake time
        if (fakeTime != null) {
          setSystemTime()
        }
        // Restore chalk
        chalk.level = origChalkLevel
      }
    }),
  )
}
