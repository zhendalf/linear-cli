import { Command } from "commander"
import { getPriorityDisplay } from "../../utils/display.ts"
import {
  fetchIssuesForState,
  getIssueIdentifier,
  getTeamKey,
} from "../../utils/linear.ts"
import { startWorkOnIssue as startIssue } from "../../utils/actions.ts"
import { searchSelect } from "../../utils/prompt.ts"
import {
  handleError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors.ts"

export const startCommand = new Command("start")
  .description("Start working on an issue")
  .argument("[issueId]")
  .option(
    "-A, --all-assignees",
    "Show issues for all assignees",
  )
  .option(
    "-U, --unassigned",
    "Show only unassigned issues",
  )
  .option(
    "-f, --from-ref <fromRef>",
    "Git ref to create new branch from",
  )
  .option(
    "-b, --branch <branch>",
    "Custom branch name to use instead of the issue identifier",
  )
  .action(async (issueId: string | undefined, options) => {
    const { allAssignees, unassigned, fromRef, branch } = options
    try {
      const teamId = getTeamKey()
      if (!teamId) {
        throw new ValidationError("Could not determine team ID")
      }

      // Validate that conflicting flags are not used together
      if (allAssignees && unassigned) {
        throw new ValidationError(
          "Cannot specify both --all-assignees and --unassigned",
        )
      }

      // Only resolve the provided issueId, don't infer from VCS
      // (start should pick from a list, not continue on current issue)
      let resolvedId = issueId ? await getIssueIdentifier(issueId) : undefined
      if (!resolvedId) {
        const result = await fetchIssuesForState(
          teamId,
          ["unstarted"],
          undefined,
          unassigned,
          allAssignees,
        )
        const issues = result.issues?.nodes || []

        if (issues.length === 0) {
          throw new NotFoundError("Unstarted issues", teamId)
        }

        resolvedId = await searchSelect({
          message: "Select an issue to start:",
          choices: issues.map((
            issue: { identifier: string; title: string; priority: number },
          ) => ({
            name: getPriorityDisplay(issue.priority) +
              ` ${issue.identifier}: ${issue.title}`,
            value: issue.identifier,
          })),
        })
      }

      if (!resolvedId) {
        throw new ValidationError("No issue ID resolved")
      }
      await startIssue(resolvedId, teamId, fromRef, branch)
    } catch (error) {
      handleError(error, "Failed to start issue")
    }
  })
