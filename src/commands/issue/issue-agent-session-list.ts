import chalk from "chalk"
import { Command, Option } from "commander"
import stringWidth from "string-width"
import { gql } from "../../__codegen__/gql.ts"
import { padDisplay, truncateText } from "../../utils/display.ts"
import { handleError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getIssueIdentifier } from "../../utils/linear.ts"
import { getConsoleSize } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"
import { header, muted } from "../../utils/styling.ts"

const GetIssueAgentSessions = gql(`
  query GetIssueAgentSessions($issueId: String!) {
    issue(id: $issueId) {
      comments(first: 100) {
        nodes {
          agentSession {
            id
            status
            createdAt
            startedAt
            endedAt
            summary
            creator {
              name
            }
            appUser {
              name
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`)

function formatStatus(status: string): string {
  switch (status) {
    case "active":
      return chalk.green(padDisplay("active", 13))
    case "pending":
      return chalk.yellow(padDisplay("pending", 13))
    case "awaitingInput":
      return chalk.yellow(padDisplay("awaitingInput", 13))
    case "complete":
      return muted(padDisplay("complete", 13))
    case "error":
      return padDisplay("error", 13)
    case "stale":
      return muted(padDisplay("stale", 13))
    default:
      return padDisplay(status, 13)
  }
}

function formatDate(dateString: string): string {
  return dateString.slice(0, 10)
}

export const agentSessionListCommand = new Command("list")
  .description("List agent sessions for an issue")
  .argument("[issueId]")
  .option("-j, --json", "Output as JSON")
  .addOption(
    new Option("--status <status>", "Filter by session status").choices([
      "pending",
      "active",
      "complete",
      "awaitingInput",
      "error",
      "stale",
    ]),
  )
  .action(async (issueId: string | undefined, options) => {
    const { json, status } = options
    try {
      const resolvedIdentifier = await getIssueIdentifier(issueId)
      if (!resolvedIdentifier) {
        throw new ValidationError("Could not determine issue ID", {
          suggestion: "Please provide an issue ID like 'ENG-123'.",
        })
      }

      const spinner = createSpinner("", shouldShowSpinner() && !json)
      spinner.start()

      const client = getGraphQLClient()
      const result = await client.request(GetIssueAgentSessions, {
        issueId: resolvedIdentifier,
      })
      spinner.stop()

      const comments = result.issue?.comments ?? {
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
        },
      }

      let sessions = comments.nodes
        .map((c) => c.agentSession)
        .filter((s): s is NonNullable<typeof s> => s != null)

      const jsonComments = status
        ? {
            ...comments,
            nodes: comments.nodes.filter((comment) => comment.agentSession?.status === status),
          }
        : comments

      if (status) {
        sessions = sessions.filter((s) => s.status === status)
      }

      if (json) {
        console.log(JSON.stringify(jsonComments, null, 2))
        return
      }

      if (sessions.length === 0) {
        console.log("No agent sessions found for this issue.")
        return
      }

      const { columns } = getConsoleSize()

      const STATUS_WIDTH = 13
      const DATE_WIDTH = 10
      const AGENT_WIDTH = Math.max(5, ...sessions.map((s) => stringWidth(s.appUser.name)))
      const SPACE_WIDTH = 3

      const fixed = STATUS_WIDTH + DATE_WIDTH + AGENT_WIDTH + SPACE_WIDTH
      const PADDING = 1
      const availableWidth = Math.max(columns - PADDING - fixed, 10)

      const headerCells = [
        padDisplay("STATUS", STATUS_WIDTH),
        padDisplay("AGENT", AGENT_WIDTH),
        padDisplay("CREATED", DATE_WIDTH),
        "SUMMARY",
      ]

      console.log(header(headerCells.join(" ")))

      for (const session of sessions) {
        const summaryText = session.summary
          ? truncateText(session.summary.replace(/\n/g, " "), availableWidth)
          : muted("--")

        const line = `${formatStatus(session.status)} ${padDisplay(
          session.appUser.name,
          AGENT_WIDTH,
        )} ${padDisplay(formatDate(session.createdAt), DATE_WIDTH)} ${summaryText}`
        console.log(line)
      }
    } catch (error) {
      handleError(error, "Failed to list agent sessions")
    }
  })
