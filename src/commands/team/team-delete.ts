import { Command, Option } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, NotFoundError, ValidationError, handleError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getAllTeams, getTeamIdByKey } from "../../utils/linear.ts"
import { confirm, select } from "../../utils/prompt.ts"
import { isStdinTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const GetTeamIssuesForMove = gql(`
  query GetTeamIssuesForMove($teamId: String!, $first: Int, $after: String) {
    team(id: $teamId) {
      issues(first: $first, after: $after) {
        nodes {
          id
          identifier
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`)

export const deleteCommand = new Command("delete")
  .description("Delete a Linear team")
  .argument("<teamKey>", "Team key to delete")
  .option("--move-issues <targetTeam>", "Move all issues to another team before deletion")
  .option("-y, --yes", "Skip confirmation prompt")
  // Back-compat alias for the old --force flag (hidden).
  .addOption(new Option("--force", "Skip confirmation prompt (alias for --yes)").hideHelp())
  .action(async (teamKey: string, options) => {
    const { moveIssues } = options
    const force = options.yes || options.force
    try {
      const client = getGraphQLClient()

      // Resolve the team ID from the key
      const teamId = await getTeamIdByKey(teamKey.toUpperCase())
      if (!teamId) {
        throw new NotFoundError("Team", teamKey)
      }

      // Get team details for confirmation message
      const teamDetailsQuery = gql(`
        query GetTeamDetails($id: String!) {
          team(id: $id) {
            id
            key
            name
            issues {
              nodes {
                id
              }
            }
          }
        }
      `)

      const teamDetails = await client.request(teamDetailsQuery, { id: teamId })

      if (!teamDetails?.team) {
        throw new NotFoundError("Team", teamKey)
      }

      const team = teamDetails.team
      const issueCount = team.issues?.nodes?.length || 0

      // If the team has issues, require --move-issues or prompt
      if (issueCount > 0 && !moveIssues) {
        console.log(`\n⚠️  Team ${team.key} (${team.name}) has ${issueCount} issue(s).`)
        console.log("You must move these issues to another team before deletion.\n")

        if (!isStdinTTY()) {
          throw new ValidationError("Interactive selection required", {
            suggestion: "Use --move-issues <teamKey> to specify target team.",
          })
        }

        const allTeams = await getAllTeams()
        const otherTeams = allTeams.filter((t) => t.id !== teamId)

        if (otherTeams.length === 0) {
          throw new CliError("No other teams available to move issues to")
        }

        const targetTeamId = await select({
          message: "Select a team to move issues to:",
          choices: otherTeams.map((t) => ({
            name: `${t.name} (${t.key})`,
            value: t.id,
          })),
        })

        // Move all issues to target team
        await moveIssuesToTeam(client, teamId, targetTeamId, issueCount)
      } else if (issueCount > 0 && moveIssues) {
        // Resolve the target team
        const targetTeamId = await getTeamIdByKey(moveIssues.toUpperCase())
        if (!targetTeamId) {
          throw new NotFoundError("Target team", moveIssues)
        }

        if (targetTeamId === teamId) {
          throw new ValidationError("Cannot move issues to the same team")
        }

        // Move all issues to target team
        await moveIssuesToTeam(client, teamId, targetTeamId, issueCount)
      }

      // Confirm deletion
      if (!force) {
        if (!isStdinTTY()) {
          throw new ValidationError("Interactive confirmation required", {
            suggestion: "Use --yes to skip.",
          })
        }
        const confirmed = await confirm({
          message: `Are you sure you want to delete team "${team.key}: ${team.name}"?`,
          default: false,
        })

        if (!confirmed) {
          console.log("Delete cancelled.")
          return
        }
      }

      // Delete the team
      const deleteTeamMutation = gql(`
        mutation DeleteTeam($id: String!) {
          teamDelete(id: $id) {
            success
          }
        }
      `)

      const result = await client.request(deleteTeamMutation, { id: teamId })

      if (result.teamDelete.success) {
        console.log(`✓ Successfully deleted team: ${team.key}: ${team.name}`)
      } else {
        throw new CliError("Failed to delete team")
      }
    } catch (error) {
      handleError(error, "Failed to delete team")
    }
  })

async function moveIssuesToTeam(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  sourceTeamId: string,
  targetTeamId: string,
  issueCount: number,
) {
  const spinner = createSpinner(
    `Moving ${issueCount} issue(s) to target team...`,
    shouldShowSpinner(),
  )
  spinner.start()

  try {
    // Fetch all issues from source team
    type IssueNode = { id: string; identifier: string }
    type PageInfo = { hasNextPage: boolean; endCursor?: string | null }
    type TeamIssuesResult = {
      team?: {
        issues?: {
          nodes?: IssueNode[]
          pageInfo?: PageInfo
        } | null
      } | null
    }

    const allIssues: IssueNode[] = []
    let hasNextPage = true
    let after: string | undefined = undefined

    while (hasNextPage) {
      const result: TeamIssuesResult = await client.request(GetTeamIssuesForMove, {
        teamId: sourceTeamId,
        first: 100,
        after,
      })

      const issues = result.team?.issues?.nodes || []
      allIssues.push(...issues)

      hasNextPage = result.team?.issues?.pageInfo?.hasNextPage || false
      after = result.team?.issues?.pageInfo?.endCursor ?? undefined
    }

    // Update each issue to move to target team
    const updateIssueMutation = gql(`
      mutation MoveIssueToTeam($id: String!, $teamId: String!) {
        issueUpdate(id: $id, input: { teamId: $teamId }) {
          success
        }
      }
    `)

    let movedCount = 0
    for (const issue of allIssues) {
      await client.request(updateIssueMutation, {
        id: issue.id,
        teamId: targetTeamId,
      })
      movedCount++
      spinner.text = `Moving issues... (${movedCount}/${allIssues.length})`
    }

    spinner.stop()
    console.log(`✓ Moved ${movedCount} issue(s) to target team`)
  } catch (error) {
    spinner.stop()
    handleError(error, "Failed to move issues")
  }
}
