import { findIssueIdentifierInText } from "./issue-identifier.ts"
import { runCommand } from "./runtime.ts"

/**
 * Utilities for jj (Jujutsu) version control system
 */

/**
 * Formats an issue description for jj describe
 * Returns the issue title and Linear-issue trailer
 */
export function formatIssueDescription(
  issueId: string,
  title: string,
  url: string,
  magicWord = "Fixes",
): string {
  return `${issueId} ${title}\n\nLinear-issue: ${magicWord} ${issueId}\nLinear-issue-url: ${url}`
}

/**
 * Checks if a jj change is empty (no description and no changes)
 */
export async function isJjChangeEmpty(): Promise<boolean> {
  // Check if description is empty
  const descResult = await runCommand("jj", [
    "log",
    "-r",
    "@",
    "-T",
    "description",
    "--no-graph",
  ])

  const description = descResult.stdout.trim()
  if (description !== "") {
    return false
  }

  // Check if there are any file changes using log -p
  const diffResult = await runCommand("jj", [
    "log",
    "-p",
    "-r",
    "@",
    "--git",
    "--no-graph",
  ])

  const diffOutput = diffResult.stdout
  // If there are file changes, the output will contain "diff --git"
  return !diffOutput.includes("diff --git")
}

/**
 * Prepares a new working state for jj
 * If current change is empty, use it; otherwise create a new change
 */
export async function prepareJjWorkingState(): Promise<void> {
  const isEmpty = await isJjChangeEmpty()
  if (!isEmpty) {
    const result = await runCommand("jj", ["new"])
    if (!result.success) {
      console.error(result.stderr)
      throw new Error("Failed to create new jj change")
    }
  }
}

/**
 * Sets the jj change description
 */
export async function setJjDescription(description: string): Promise<void> {
  const result = await runCommand("jj", ["describe", "-m", description])
  if (!result.success) {
    console.error(result.stderr)
    throw new Error("Failed to set jj description")
  }
}

/**
 * Creates a new empty jj change
 */
export async function createJjNewChange(): Promise<void> {
  const result = await runCommand("jj", ["new"])
  if (!result.success) {
    console.error(result.stderr)
    throw new Error("Failed to create new jj change")
  }
}

/**
 * Parses a Linear issue identifier from a Linear-issue trailer value
 * Supports two formats:
 * - New format: "Fixes ABC-123" (with magic words)
 * - Old format: [ABC-123](https://linear.app/...)
 * Returns the issue identifier (e.g., "ABC-123") or null if not found
 */
export function parseLinearIssueFromTrailer(
  trailerValue: string,
): string | null {
  return findIssueIdentifierInText(trailerValue)?.identifier ?? null
}

/**
 * Parses the output from jj log trailers command
 * Returns the last valid issue ID from the first commit with Linear-issue trailer(s)
 * If multiple trailers exist in a commit, returns the last one
 */
export function parseJjTrailersOutput(output: string): string | null {
  // Collect all valid issue IDs from the first commit with Linear-issue trailer(s)
  // If multiple trailers exist in a commit, use the last one
  const lines = output.split("\n")
  let lastValidIssueId: string | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) {
      const issueId = parseLinearIssueFromTrailer(trimmed)
      if (issueId) {
        lastValidIssueId = issueId
      }
    } else if (lastValidIssueId) {
      // Empty line indicates end of current commit's trailers
      // Return the last valid issue ID found in this commit
      return lastValidIssueId
    }
  }

  // Return the last valid issue ID found (handles case where output doesn't end with blank line)
  return lastValidIssueId
}

/**
 * Gets the current Linear issue ID from jj commit trailers
 * Searches the current change and ancestors for the most recent Linear-issue trailer
 * If multiple Linear-issue trailers exist in a commit, returns the last one
 * Returns the issue identifier (e.g., "ABC-123") or null if not found
 */
export async function getJjLinearIssue(): Promise<string | null> {
  // Use jj log with trailers template to extract Linear-issue trailer value
  // Search all ancestors starting from current change
  const result = await runCommand("jj", [
    "log",
    "-r",
    "::@",
    "-T",
    'trailers.map(|t| if(t.key() == "Linear-issue", t.value(), ""))',
    "--no-graph",
  ])

  if (!result.success) {
    return null
  }

  return parseJjTrailersOutput(result.stdout)
}
