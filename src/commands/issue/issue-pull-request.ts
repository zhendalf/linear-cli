import { Command } from "commander"
import { fetchIssueDetails, getIssueIdentifier } from "../../utils/linear.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { CliError, handleError, ValidationError } from "../../utils/errors.ts"
import { spawn } from "node:child_process"

export const pullRequestCommand = new Command("pull-request")
  .description("Create a GitHub pull request with issue details")
  .alias("pr")
  .option(
    "--base <branch>",
    "The branch into which you want your code merged",
  )
  .option(
    "--draft",
    "Create the pull request as a draft",
  )
  .option(
    "-t, --title <title>",
    "Optional title for the pull request (Linear issue ID will be prefixed)",
  )
  .option(
    "--web",
    "Open the pull request in the browser after creating it",
  )
  .option(
    "--head <branch>",
    "The branch that contains commits for your pull request",
  )
  .argument("[issueId]")
  .action(async (issueId: string | undefined, options) => {
    const { base, draft, title: customTitle, web, head } = options
    try {
      const resolvedId = await getIssueIdentifier(issueId)
      if (!resolvedId) {
        throw new ValidationError(
          "Could not determine issue ID",
          { suggestion: "Please provide an issue ID like 'ENG-123'." },
        )
      }
      const { title, url } = await fetchIssueDetails(
        resolvedId,
        shouldShowSpinner(),
      )

      const args = [
        "pr",
        "create",
        "--title",
        `${resolvedId} ${customTitle ?? title}`,
        "--body",
        url,
        ...(base ? ["--base", base] : []),
        ...(head ? ["--head", head] : []),
        ...(draft ? ["--draft"] : []),
        ...(web ? ["--web"] : []),
      ]

      await new Promise<void>((resolve, reject) => {
        const proc = spawn("gh", args, { stdio: "inherit" })
        proc.on("close", (code) => {
          if (code !== 0) {
            reject(new CliError("Failed to create pull request"))
          } else {
            resolve()
          }
        })
        proc.on("error", reject)
      })
    } catch (error) {
      handleError(error, "Failed to create pull request")
    }
  })
