import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { renderMarkdown } from "../../utils/charmd/mod.ts"
import { formatRelativeTime } from "../../utils/display.ts"
import { handleError, NotFoundError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getCycleIdByNameOrNumber, getTeamIdByKey, getTeamKey } from "../../utils/linear.ts"
import { pipeToUserPager, shouldUsePager } from "../../utils/pager.ts"
import { getConsoleSize, isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const GetCycleDetails = gql(`
  query GetCycleDetails($id: String!) {
    cycle(id: $id) {
      id
      number
      name
      description
      startsAt
      endsAt
      completedAt
      isActive
      isFuture
      isPast
      createdAt
      updatedAt
      team {
        id
        key
        name
      }
      issues {
        nodes {
          id
          identifier
          title
          state {
            name
            type
          }
        }
      }
    }
  }
`)

export const viewCommand = new Command("view")
  .alias("v")
  .description("View cycle details")
  .argument("<cycleRef>", "Cycle reference (name or number)")
  .option("--team <team>", "Team key (defaults to current team)")
  .option("--no-pager", "Disable automatic paging for long output")
  .action(async (cycleRef: string, options) => {
    const { team, pager } = options
    const usePager = pager !== false
    try {
      const teamKey = team || getTeamKey()
      if (!teamKey) {
        throw new ValidationError("Could not determine team key from directory name or team flag")
      }

      const teamId = await getTeamIdByKey(teamKey)
      if (!teamId) {
        throw new NotFoundError("Team", teamKey)
      }

      const cycleId = await getCycleIdByNameOrNumber(cycleRef, teamId)

      const spinner = createSpinner("", shouldShowSpinner())
      spinner.start()

      const client = getGraphQLClient()
      const result = await client.request(GetCycleDetails, { id: cycleId })
      spinner.stop()

      const cycle = result.cycle
      if (!cycle) {
        throw new NotFoundError("Cycle", cycleRef)
      }

      const lines: string[] = []

      const title = cycle.name || `Cycle ${cycle.number}`
      lines.push(`# ${title}`)
      lines.push("")

      lines.push(`**Number:** ${cycle.number}`)
      lines.push(`**Start:** ${cycle.startsAt.slice(0, 10)}`)
      lines.push(`**End:** ${cycle.endsAt.slice(0, 10)}`)

      let status = "Unknown"
      if (cycle.isActive) status = "Active"
      else if (cycle.isFuture) status = "Upcoming"
      else if (cycle.completedAt != null) status = "Completed"
      else if (cycle.isPast) status = "Past"
      lines.push(`**Status:** ${status}`)

      lines.push(`**Team:** ${cycle.team.name} (${cycle.team.key})`)

      lines.push("")
      lines.push(`**Created:** ${formatRelativeTime(cycle.createdAt)}`)
      lines.push(`**Updated:** ${formatRelativeTime(cycle.updatedAt)}`)

      if (cycle.description) {
        lines.push("")
        lines.push("## Description")
        lines.push("")
        lines.push(cycle.description)
      }

      if (cycle.issues.nodes.length > 0) {
        lines.push("")
        lines.push("## Issues")
        lines.push("")

        const issuesByState = cycle.issues.nodes.reduce(
          (acc: Record<string, number>, issue) => {
            const stateType = issue.state.type
            if (!acc[stateType]) acc[stateType] = 0
            acc[stateType]++
            return acc
          },
          {} as Record<string, number>,
        )

        const total = cycle.issues.nodes.length
        const completed = issuesByState.completed || 0
        const started = issuesByState.started || 0
        const unstarted = issuesByState.unstarted || 0
        const canceled = issuesByState.canceled || 0
        const backlog = issuesByState.backlog || 0
        const triage = issuesByState.triage || 0

        const pct = Math.round((completed / total) * 100)
        lines.push(`**Progress:** ${completed}/${total} (${pct}%)`)
        lines.push(`**Total Issues:** ${total}`)
        if (completed > 0) lines.push(`**Completed:** ${completed}`)
        if (started > 0) lines.push(`**In Progress:** ${started}`)
        if (unstarted > 0) lines.push(`**To Do:** ${unstarted}`)
        if (backlog > 0) lines.push(`**Backlog:** ${backlog}`)
        if (triage > 0) lines.push(`**Triage:** ${triage}`)
        if (canceled > 0) lines.push(`**Canceled:** ${canceled}`)

        lines.push("")
        lines.push("**Issues:**")
        lines.push("")
        cycle.issues.nodes.slice(0, 10).forEach((issue) => {
          lines.push(`- ${issue.identifier}: ${issue.title} (${issue.state.name})`)
        })

        if (cycle.issues.nodes.length > 10) {
          lines.push("")
          lines.push(`_...and ${cycle.issues.nodes.length - 10} more issues_`)
        }
      } else {
        lines.push("")
        lines.push("_No issues in this cycle yet._")
      }

      const markdown = lines.join("\n")

      if (isStdoutTTY()) {
        const terminalWidth = getConsoleSize().columns
        const finalOutput = renderMarkdown(markdown, { lineWidth: terminalWidth })
        if (shouldUsePager(finalOutput.split("\n"), usePager)) {
          await pipeToUserPager(finalOutput)
        } else {
          console.log(finalOutput)
        }
      } else {
        console.log(markdown)
      }
    } catch (error) {
      handleError(error, "Failed to fetch cycle details")
    }
  })
