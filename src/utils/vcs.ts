import { select } from "./prompt.ts"
import { getOption } from "../config.ts"
import { CliError } from "./errors.ts"
import { getCurrentBranch } from "./git.ts"
import { findIssueIdentifierInText } from "./issue-identifier.ts"
import { fetchIssueDetails } from "./linear.ts"
import {
  formatIssueDescription,
  getJjLinearIssue,
  prepareJjWorkingState,
  setJjDescription,
} from "./jj.ts"
import { runCommand } from "./runtime.ts"

export type VcsType = "git" | "jj"

export function getVcs(): VcsType {
  return getOption("vcs") || "git"
}

/**
 * Returns an appropriate error message when no issue ID is found
 */
export function getNoIssueFoundMessage(): string {
  const vcs = getVcs()
  switch (vcs) {
    case "git":
      return "The current branch does not contain a valid linear issue id."
    case "jj":
      return "No Linear-issue trailer found in current or ancestor commits."
    default:
      throw vcs satisfies never
  }
}

/**
 * Checks if a git branch exists
 */
async function gitBranchExists(branchName: string): Promise<boolean> {
  try {
    const result = await runCommand("git", [
      "rev-parse",
      "--verify",
      branchName,
    ])
    return result.success
  } catch (error) {
    throw new CliError(
      `Failed to check if branch exists: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    )
  }
}

/**
 * Gets the current issue identifier from VCS state
 * For git: extracts from branch name
 * For jj: extracts from Linear-issue trailer in commit history
 * Returns the issue identifier (e.g., "ABC-123") or null if not found
 */
export async function getCurrentIssueFromVcs(): Promise<string | null> {
  const vcs = getVcs()

  switch (vcs) {
    case "git": {
      const branch = await getCurrentBranch()
      if (!branch) return null

      const issueIdentifier = findIssueIdentifierInText(branch)?.identifier
      return issueIdentifier ?? null
    }
    case "jj": {
      return await getJjLinearIssue()
    }
    default:
      throw vcs satisfies never
  }
}

/**
 * Start work on an issue using the appropriate VCS
 */
export async function startVcsWork(
  issueId: string,
  branchName: string,
  gitSourceRef?: string,
): Promise<void> {
  const vcs = getVcs()

  switch (vcs) {
    case "git": {
      // Check if branch exists
      if (await gitBranchExists(branchName)) {
        const answer = await select({
          message:
            `Branch ${branchName} already exists. What would you like to do?`,
          choices: [
            { name: "Switch to existing branch", value: "switch" },
            { name: "Create new branch with suffix", value: "create" },
          ],
        })

        if (answer === "switch") {
          const { success, stderr } = await runCommand("git", [
            "checkout",
            branchName,
          ])
          if (!success) {
            throw new CliError(
              `Failed to switch to branch '${branchName}': ${stderr.trim()}`,
            )
          }
          console.log(`✓ Switched to '${branchName}'`)
        } else {
          // Find next available suffix
          let suffix = 1
          let newBranch = `${branchName}-${suffix}`
          while (await gitBranchExists(newBranch)) {
            suffix++
            newBranch = `${branchName}-${suffix}`
          }

          const { success, stderr } = await runCommand("git", [
            "checkout",
            "-b",
            newBranch,
            gitSourceRef || "HEAD",
          ])
          if (!success) {
            throw new CliError(
              `Failed to create branch '${newBranch}': ${stderr.trim()}`,
            )
          }
          console.log(`✓ Created and switched to branch '${newBranch}'`)
        }
      } else {
        // Create and checkout the branch
        const { success, stderr } = await runCommand("git", [
          "checkout",
          "-b",
          branchName,
          gitSourceRef || "HEAD",
        ])
        if (!success) {
          throw new CliError(
            `Failed to create branch '${branchName}': ${stderr.trim()}`,
          )
        }
        console.log(`✓ Created and switched to branch '${branchName}'`)
      }
      break
    }
    case "jj": {
      await prepareJjWorkingState()

      // Fetch issue details to format the description
      const { title, url } = await fetchIssueDetails(issueId, false)
      const description = formatIssueDescription(issueId, title, url)
      await setJjDescription(description)

      console.log(`✓ Prepared jj change for issue ${issueId}`)
      break
    }
    default:
      throw vcs satisfies never
  }
}
