import { readFile } from "node:fs/promises"
import { Command, Option } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import type { IssueUpdateInput } from "../../__codegen__/graphql.ts"
import { CliError, handleError, NotFoundError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getTeamKeyFromIssueIdentifier } from "../../utils/issue-identifier.ts"
import {
  getCycleIdByNameOrNumber,
  getIssueId,
  getIssueIdentifier,
  getIssueLabelIdByNameForTeam,
  getIssueProjectId,
  getMilestoneIdByName,
  getProjectIdByName,
  getTeamIdByKey,
  getWorkflowStateByNameOrType,
  lookupUserId,
} from "../../utils/linear.ts"
import { collect } from "../../utils/option-parsers.ts"
import { createSpinner } from "../../utils/spinner.ts"

export const updateCommand = new Command("update")
  .description("Update a linear issue")
  .argument("[issueId]")
  .option(
    "-a, --assignee <assignee>",
    "Assign the issue to 'self' or someone (by username or name)",
  )
  .option("--unassign", "Clear the issue's assignee (cannot be combined with --assignee)")
  .option("--due-date <dueDate>", "Due date of the issue")
  .option("--parent <parent>", "Parent issue (if any) as a team_number code")
  .addOption(
    new Option(
      "-p, --priority <priority>",
      "Priority of the issue (1-4, descending priority)",
    ).argParser(Number),
  )
  .addOption(new Option("--estimate <estimate>", "Points estimate of the issue").argParser(Number))
  .option("-d, --description <description>", "Description of the issue")
  .option(
    "--description-file <path>",
    "Read description from a file (preferred for markdown content)",
  )
  .option(
    "-l, --label <label>",
    "Issue label associated with the issue; replaces the issue's entire label set. May be repeated. Use --add-label/--remove-label to change labels incrementally.",
    collect,
  )
  .option(
    "--add-label <label>",
    "Add a label to the issue, keeping its existing labels. May be repeated.",
    collect,
  )
  .option(
    "--remove-label <label>",
    "Remove a label from the issue, keeping its other labels (does not delete the label from the team). May be repeated.",
    collect,
  )
  .option("--team <team>", "Team associated with the issue (if not your default team)")
  .option("--project <project>", "Name or slug ID of the project with the issue")
  .option("-s, --state <state>", "Workflow state for the issue (by name or type)")
  .option("--milestone <milestone>", "Name of the project milestone")
  .option(
    "--cycle <cycle>",
    "Cycle name, number, or 'active'. Use --clear-cycle to remove the issue from its cycle",
  )
  .option("--clear-cycle", "Remove the issue from its cycle")
  .option("-t, --title <title>", "Title of the issue")
  .action(async (issueIdArg: string | undefined, options) => {
    const {
      assignee,
      unassign,
      dueDate,
      parent,
      priority,
      estimate,
      description,
      descriptionFile,
      label: labels,
      addLabel,
      removeLabel,
      team,
      project,
      state,
      milestone,
      cycle,
      clearCycle,
      title,
    } = options
    try {
      if (unassign && assignee != null) {
        throw new ValidationError("Cannot specify both --assignee and --unassign", {
          suggestion:
            "Use --assignee <user> to set an assignee, or --unassign on its own to clear it.",
        })
      }

      if (clearCycle && cycle != null) {
        throw new ValidationError("Cannot specify both --cycle and --clear-cycle", {
          suggestion:
            "Use --cycle <cycle> to set a cycle, or --clear-cycle on its own to remove it.",
        })
      }

      if (labels != null && (addLabel != null || removeLabel != null)) {
        throw new ValidationError("Cannot combine --label with --add-label or --remove-label", {
          suggestion:
            "--label replaces the issue's entire label set. Use it alone to set the exact set, or use --add-label/--remove-label alone to change it incrementally.",
        })
      }

      // Label names resolve against the issue's (destination) team, so a
      // team move combined with incremental label changes would silently
      // make source-team labels unresolvable.
      if (team != null && (addLabel != null || removeLabel != null)) {
        throw new ValidationError("Cannot combine --team with --add-label or --remove-label", {
          suggestion: "Move the issue with --team first, then change labels in a second update.",
        })
      }

      // Validate that description and descriptionFile are not both provided
      if (description && descriptionFile) {
        throw new ValidationError("Cannot specify both --description and --description-file")
      }

      // Read description from file if provided
      let finalDescription = description
      if (descriptionFile) {
        try {
          finalDescription = await readFile(descriptionFile, "utf8")
        } catch (error) {
          throw new ValidationError(`Failed to read description file: ${descriptionFile}`, {
            suggestion: `Error: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }

      // Get the issue ID - either from argument or infer from current context
      const issueId = await getIssueIdentifier(issueIdArg)
      if (!issueId) {
        throw new ValidationError("Could not determine issue ID", {
          suggestion:
            "Please provide an issue ID like 'ENG-123' or run from a branch with an issue ID.",
        })
      }

      const spinner = createSpinner("", shouldShowSpinner())
      spinner.start()

      // Extract team from issue ID if not provided
      let teamKey = team
      if (!teamKey) {
        teamKey = getTeamKeyFromIssueIdentifier(issueId)
      }
      if (!teamKey) {
        throw new ValidationError("Could not determine team key from issue ID")
      }

      // Convert team key to team ID for some operations
      const teamId = await getTeamIdByKey(teamKey)
      if (!teamId) {
        throw new NotFoundError("Team", teamKey)
      }

      let stateId: string | undefined
      if (state) {
        const workflowState = await getWorkflowStateByNameOrType(teamKey, state)
        if (!workflowState) {
          throw new NotFoundError("Workflow state", `'${state}' for team ${teamKey}`)
        }
        stateId = workflowState.id
      }

      let assigneeId: string | undefined
      if (assignee !== undefined) {
        assigneeId = await lookupUserId(assignee)
        if (!assigneeId) {
          throw new NotFoundError("User", assignee)
        }
      }

      // Resolves label names to IDs, deduped by resolved ID so case
      // variants of the same label collapse to one entry.
      const resolveLabelIds = async (names: string[]): Promise<string[]> => {
        const ids: string[] = []
        for (const name of names) {
          const labelId = await getIssueLabelIdByNameForTeam(name, teamKey)
          if (!labelId) {
            throw new NotFoundError("Issue label", name, {
              suggestion: `Run \`linear label list --team ${teamKey}\` to see available labels.`,
            })
          }
          if (!ids.includes(labelId)) {
            ids.push(labelId)
          }
        }
        return ids
      }

      const labelIds = labels != null ? await resolveLabelIds(labels) : []
      const addedLabelIds = addLabel != null ? await resolveLabelIds(addLabel) : []
      const removedLabelIds = removeLabel != null ? await resolveLabelIds(removeLabel) : []

      if (addedLabelIds.some((id) => removedLabelIds.includes(id))) {
        throw new ValidationError("Cannot add and remove the same label in one update", {
          suggestion: "Remove the duplicate label from either --add-label or --remove-label.",
        })
      }

      let projectId: string | undefined
      if (project !== undefined) {
        projectId = await getProjectIdByName(project)
        if (projectId === undefined) {
          throw new NotFoundError("Project", project)
        }
      }

      let projectMilestoneId: string | undefined
      if (milestone != null) {
        const milestoneProjectId = projectId ?? (await getIssueProjectId(issueId))
        if (milestoneProjectId == null) {
          throw new ValidationError(
            "--milestone requires --project to be set (issue has no existing project)",
            {
              suggestion: "Use --project to specify the project for the milestone.",
            },
          )
        }
        projectMilestoneId = await getMilestoneIdByName(milestone, milestoneProjectId)
      }

      let cycleId: string | undefined
      if (cycle != null) {
        cycleId = await getCycleIdByNameOrNumber(cycle, teamId)
      }

      // Build the update input object, only including fields that were provided.
      // Clearing a field requires an explicit flag (see --unassign and
      // --clear-cycle); never set a field to null implicitly.
      const input: IssueUpdateInput = {}

      if (title !== undefined) input.title = title
      if (unassign) {
        input.assigneeId = null
      } else if (assigneeId != null) {
        input.assigneeId = assigneeId
      }
      if (dueDate !== undefined) input.dueDate = dueDate
      if (parent !== undefined) {
        const parentIdentifier = await getIssueIdentifier(parent)
        if (!parentIdentifier) {
          throw new ValidationError(`Could not resolve parent issue identifier: ${parent}`)
        }
        const parentId = await getIssueId(parentIdentifier)
        if (!parentId) {
          throw new NotFoundError("Parent issue", parentIdentifier)
        }
        input.parentId = parentId
      }
      if (priority !== undefined) input.priority = priority
      if (estimate !== undefined) input.estimate = estimate
      if (finalDescription !== undefined) input.description = finalDescription
      if (labels != null) {
        input.labelIds = labelIds
      } else {
        if (addLabel != null) input.addedLabelIds = addedLabelIds
        if (removeLabel != null) input.removedLabelIds = removedLabelIds
      }
      if (teamId !== undefined) input.teamId = teamId
      if (projectId !== undefined) input.projectId = projectId
      if (projectMilestoneId !== undefined) {
        input.projectMilestoneId = projectMilestoneId
      }
      if (clearCycle) {
        input.cycleId = null
      } else if (cycleId !== undefined) {
        input.cycleId = cycleId
      }
      if (stateId !== undefined) input.stateId = stateId

      spinner.stop()
      console.log(`Updating issue ${issueId}`)
      console.log()
      spinner.start()

      const updateIssueMutation = gql(`
          mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue { id, identifier, url, title }
            }
          }
        `)

      const client = getGraphQLClient()
      const data = await client.request(updateIssueMutation, {
        id: issueId,
        input,
      })

      if (!data.issueUpdate.success) {
        throw new CliError("Issue update failed")
      }

      const issue = data.issueUpdate.issue
      if (!issue) {
        throw new CliError("Issue update failed - no issue returned")
      }

      spinner.stop()
      console.log(`✓ Updated issue ${issue.identifier}: ${issue.title}`)
      console.log(issue.url)
    } catch (error) {
      handleError(error, "Failed to update issue")
    }
  })
