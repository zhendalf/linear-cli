import { basename } from "node:path"
import { CliError } from "./errors.ts"
import { runCommand } from "./runtime.ts"

export async function getCurrentBranch(): Promise<string | null> {
  const { success, stdout, stderr } = await runCommand("git", [
    "symbolic-ref",
    "--short",
    "HEAD",
  ])

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
  const { success, stdout, stderr } = await runCommand("git", [
    "rev-parse",
    "--show-toplevel",
  ])

  if (!success) {
    const errorMsg = stderr.trim()
    throw new CliError(`Failed to get repository directory: ${errorMsg}`)
  }

  const fullPath = stdout.trim()
  return basename(fullPath)
}

export async function branchExists(branch: string): Promise<boolean> {
  try {
    const { success } = await runCommand("git", [
      "rev-parse",
      "--verify",
      branch,
    ])
    return success
  } catch {
    return false
  }
}
