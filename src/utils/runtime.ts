/**
 * Deno → Node shim: subprocess, TTY, console-size, ENOENT, platform helpers.
 * All later phases import from here instead of calling Node APIs directly.
 */

import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface RunCommandResult {
  success: boolean
  code: number
  stdout: string
  stderr: string
}

/**
 * Run a subprocess and collect its output.
 * Never throws on non-zero exit; check `.success` / `.code` instead.
 */
export async function runCommand(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string> },
): Promise<RunCommandResult> {
  try {
    // Match Deno.Command semantics: `env` overrides MERGE with the parent
    // environment (Deno inherits unless clearEnv is set), so a single override
    // must not drop PATH and break executable resolution.
    const env = opts?.env
      ? { ...process.env, ...opts.env }
      : process.env
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: opts?.cwd,
      env,
      encoding: "utf8",
    })
    return { success: true, code: 0, stdout, stderr }
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string
      stderr?: string
      code?: number | string
    }
    const exitCode = typeof e.code === "number" ? e.code : 1
    return {
      success: false,
      code: exitCode,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
    }
  }
}

/** Whether stdout is an interactive TTY. */
export function isStdoutTTY(): boolean {
  return process.stdout.isTTY === true
}

/** Whether stdin is an interactive TTY. */
export function isStdinTTY(): boolean {
  return process.stdin.isTTY === true
}

/** Whether stderr is an interactive TTY. */
export function isStderrTTY(): boolean {
  return process.stderr.isTTY === true
}

/** Terminal dimensions. Falls back to 80×24 when not a TTY or columns/rows are undefined. */
export function getConsoleSize(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
  }
}

/** Returns true when `e` is an ENOENT (file/directory not found) error. */
export function isNotFoundError(e: unknown): boolean {
  return (e as NodeJS.ErrnoException | null)?.code === "ENOENT"
}

/** True when running on Windows. */
export const isWindows: boolean = process.platform === "win32"
