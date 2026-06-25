import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { renderMarkdown } from "../../utils/charmd/mod.ts"
import { formatRelativeTime } from "../../utils/display.ts"
import { NotFoundError, handleError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { pipeToUserPager, shouldUsePager } from "../../utils/pager.ts"
import { getConsoleSize, isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const GetAgentSessionDetails = gql(`
  query GetAgentSessionDetails($id: String!) {
    agentSession(id: $id) {
      id
      status
      type
      createdAt
      updatedAt
      startedAt
      endedAt
      dismissedAt
      summary
      externalLink
      creator {
        name
      }
      appUser {
        name
      }
      dismissedBy {
        name
      }
      issue {
        identifier
        title
        url
      }
      activities(first: 20) {
        nodes {
          id
          createdAt
          content {
            ... on AgentActivityThoughtContent {
              type
              body
            }
            ... on AgentActivityActionContent {
              type
              action
              parameter
              result
            }
            ... on AgentActivityResponseContent {
              type
              body
            }
            ... on AgentActivityPromptContent {
              type
              body
            }
            ... on AgentActivityErrorContent {
              type
              body
            }
            ... on AgentActivityElicitationContent {
              type
              body
            }
          }
        }
      }
    }
  }
`)

export const agentSessionViewCommand = new Command("view")
  .description("View agent session details")
  .alias("v")
  .argument("<sessionId>")
  .option("-j, --json", "Output as JSON")
  .option("--no-pager", "Disable automatic paging for long output")
  .action(async (sessionId: string, options) => {
    const { json, pager } = options
    const usePager = pager !== false
    try {
      const spinner = createSpinner("", shouldShowSpinner() && !json)
      spinner.start()

      const client = getGraphQLClient()
      const result = await client.request(GetAgentSessionDetails, {
        id: sessionId,
      })
      spinner.stop()

      const session = result.agentSession
      if (!session) {
        throw new NotFoundError("Agent session", sessionId)
      }

      if (json) {
        console.log(JSON.stringify(session, null, 2))
        return
      }

      const lines: string[] = []

      lines.push(`# Agent Session`)
      lines.push("")

      lines.push(`**ID:** ${session.id}`)
      lines.push(`**Status:** ${session.status}`)
      lines.push(`**Type:** ${session.type}`)
      lines.push(`**Agent:** ${session.appUser.name}`)

      if (session.creator) {
        lines.push(`**Creator:** ${session.creator.name}`)
      }

      if (session.issue) {
        lines.push(`**Issue:** ${session.issue.identifier} - ${session.issue.title}`)
      }

      lines.push("")
      lines.push(`**Created:** ${formatRelativeTime(session.createdAt)}`)
      if (session.startedAt) {
        lines.push(`**Started:** ${formatRelativeTime(session.startedAt)}`)
      }
      if (session.endedAt) {
        lines.push(`**Ended:** ${formatRelativeTime(session.endedAt)}`)
      }
      if (session.dismissedAt) {
        lines.push(`**Dismissed:** ${formatRelativeTime(session.dismissedAt)}`)
        if (session.dismissedBy) {
          lines.push(`**Dismissed by:** ${session.dismissedBy.name}`)
        }
      }

      if (session.externalLink) {
        lines.push("")
        lines.push(`**External Link:** ${session.externalLink}`)
      }

      if (session.summary) {
        lines.push("")
        lines.push("## Summary")
        lines.push("")
        lines.push(session.summary)
      }

      if (session.activities.nodes.length > 0) {
        lines.push("")
        lines.push("## Activities")
        lines.push("")
        for (const activity of session.activities.nodes) {
          const time = formatRelativeTime(activity.createdAt)
          const content = activity.content
          const type = "type" in content ? content.type : "unknown"
          let detail = ""
          if ("body" in content && content.body) {
            detail = ` - ${content.body.replace(/\n/g, " ")}`
          } else if ("action" in content && content.action) {
            detail = ` - ${content.action}: ${content.parameter}`
          }
          lines.push(`- **${type}** (${time})${detail}`)
        }
      }

      const markdown = lines.join("\n")

      if (isStdoutTTY()) {
        const { columns: terminalWidth } = getConsoleSize()
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
      handleError(error, "Failed to fetch agent session details")
    }
  })
