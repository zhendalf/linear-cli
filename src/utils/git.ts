import { basename } from "node:path"
import { CliError } from "./errors.ts"
import { runCommand } from "./runtime.ts"

export async function getCurrentBranch(): Promise<string | null> {
  const { success, stdout, stderr } = await runCommand("git", ["symbolic-ref", "--short", "HEAD"])

  if (!success) {
    const errorMsg = stderr.trim()
    // Handle detached HEAD state gracefully - this is not necessarily an error
    if (errorMsg.includes("not a symbolic ref")) {
      return null
    }
    throw new CliError(`Failed to get current branch: ${errorMsg}`)
  }

  const branch = stdout.trim()
  return branch || null
}

export async function getRepoDir(): Promise<string> {
  const { success, stdout, stderr } = await runCommand("git", ["rev-parse", "--show-toplevel"])

  if (!success) {
    const errorMsg = stderr.trim()
    throw new CliError(`Failed to get repository directory: ${errorMsg}`)
  }

  const fullPath = stdout.trim()
  return basename(fullPath)
}

/**
 * Best-effort check for whether the current directory is inside a git work
 * tree. Any failure — git not installed, not a repository, dubious ownership,
 * a spawn error — counts as false: callers use this only for optional
 * guidance, which must never turn into a git crash.
 */
export async function isInsideGitRepo(): Promise<boolean> {
  try {
    const { success, stdout } = await runCommand("git", ["rev-parse", "--is-inside-work-tree"])
    // Prints "false" (exit 0) inside a .git dir or a bare repo, so the exit
    // status alone is not enough.
    return success && stdout.trim() === "true"
  } catch {
    return false
  }
}

export async function branchExists(branch: string): Promise<boolean> {
  try {
    const { success } = await runCommand("git", ["rev-parse", "--verify", branch])
    return success
  } catch {
    return false
  }
}
