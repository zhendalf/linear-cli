import { spawn } from "node:child_process"
import { Command } from "commander"
import {
  NotFoundError,
  ValidationError,
  handleError,
  isClientError,
  isNotFoundError,
} from "../../utils/errors.ts"
import { getIssueId, getIssueIdentifier } from "../../utils/linear.ts"
import { getVcs } from "../../utils/vcs.ts"

export const commitsCommand = new Command("commits")
  .description("Show all commits for a Linear issue (jj only)")
  .argument("[issueId]")
  .action(async (issueId: string | undefined) => {
    try {
      const vcs = getVcs()

      if (vcs !== "jj") {
        throw new ValidationError("commits is only supported with jj-vcs", {
          suggestion: "This command requires jujutsu (jj) version control.",
        })
      }

      const resolvedId = await getIssueIdentifier(issueId)
      if (!resolvedId) {
        throw new ValidationError("Could not determine issue ID", {
          suggestion: "Please provide an issue ID like 'ENG-123'.",
        })
      }

      // Verify the issue exists in Linear
      let linearIssueId: string | undefined
      try {
        linearIssueId = await getIssueId(resolvedId)
      } catch (error) {
        if (isClientError(error) && isNotFoundError(error)) {
          throw new NotFoundError("Issue", resolvedId)
        }
        throw error
      }
      if (!linearIssueId) {
        throw new NotFoundError("Issue", resolvedId)
      }

      // Build the revset to find all commits with this Linear issue
      const revset = `description(regex:"(?m)^Linear-issue:.*${resolvedId}")`

      // First check if any commits exist
      await new Promise<void>((resolve, reject) => {
        const checkProcess = spawn("jj", ["log", "-r", revset, "-T", "commit_id", "--no-graph"], {
          stdio: ["inherit", "pipe", "pipe"],
        })
        let stdout = ""
        checkProcess.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString()
        })
        checkProcess.on("close", (code) => {
          if (code !== 0) {
            reject(new NotFoundError("Commits", resolvedId))
            return
          }
          if (!stdout.trim()) {
            reject(new NotFoundError("Commits", resolvedId))
            return
          }
          resolve()
        })
        checkProcess.on("error", reject)
      })

      // Show the commits with full details
      await new Promise<void>((resolve, reject) => {
        const jjProcess = spawn(
          "jj",
          [
            "log",
            "-r",
            revset,
            "-p",
            "--git",
            "--no-graph",
            "-T",
            "builtin_log_compact_full_description",
          ],
          {
            stdio: "inherit",
          },
        )
        jjProcess.on("close", (code) => {
          process.exitCode = code ?? 0
          resolve()
        })
        jjProcess.on("error", reject)
      })
    } catch (error) {
      handleError(error, "Failed to show commits")
    }
  })
