import { agentSessionListCommand } from "../../../src/commands/issue/issue-agent-session-list.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

await snapshotTest({
  name: "Issue Agent Session List Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await agentSessionListCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

await snapshotTest({
  name: "Issue Agent Session List Command - With Mock Sessions",
  meta: import.meta,
  colors: false,
  args: ["ENG-412"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetIssueAgentSessions",
        variables: { issueId: "ENG-412" },
        response: {
          data: {
            issue: {
              comments: {
                nodes: [
                  {
                    agentSession: {
                      id: "session-1",
                      status: "active",
                      createdAt: "2026-03-20T10:00:00.000Z",
                      startedAt: "2026-03-20T10:00:05.000Z",
                      endedAt: null,
                      summary: "Investigating auth token refresh bug",
                      creator: { name: "Alice" },
                      appUser: { name: "Linear Assistant" },
                    },
                  },
                  {
                    agentSession: {
                      id: "session-2",
                      status: "complete",
                      createdAt: "2026-03-19T15:30:00.000Z",
                      startedAt: "2026-03-19T15:30:05.000Z",
                      endedAt: "2026-03-19T16:00:00.000Z",
                      summary: "Added dark mode toggle to settings page",
                      creator: { name: "Bob" },
                      appUser: { name: "Linear Assistant" },
                    },
                  },
                  {
                    agentSession: null,
                  },
                ],
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await agentSessionListCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

await snapshotTest({
  name: "Issue Agent Session List Command - No Sessions Found",
  meta: import.meta,
  colors: false,
  args: ["ENG-412"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetIssueAgentSessions",
        variables: { issueId: "ENG-412" },
        response: {
          data: {
            issue: {
              comments: {
                nodes: [{ agentSession: null }, { agentSession: null }],
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await agentSessionListCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

await snapshotTest({
  name: "Issue Agent Session List Command - JSON Output",
  meta: import.meta,
  colors: false,
  args: ["ENG-412", "--json", "--status", "active"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetIssueAgentSessions",
        variables: { issueId: "ENG-412" },
        response: {
          data: {
            issue: {
              comments: {
                nodes: [
                  {
                    agentSession: {
                      id: "session-1",
                      status: "active",
                      createdAt: "2026-03-20T10:00:00.000Z",
                      startedAt: "2026-03-20T10:00:05.000Z",
                      endedAt: null,
                      summary: "Investigating auth token refresh bug",
                      creator: { name: "Alice" },
                      appUser: { name: "Linear Assistant" },
                    },
                  },
                  {
                    agentSession: {
                      id: "session-2",
                      status: "complete",
                      createdAt: "2026-03-19T15:30:00.000Z",
                      startedAt: "2026-03-19T15:30:05.000Z",
                      endedAt: "2026-03-19T16:00:00.000Z",
                      summary: "Added dark mode toggle to settings page",
                      creator: { name: "Bob" },
                      appUser: { name: "Linear Assistant" },
                    },
                  },
                  {
                    agentSession: null,
                  },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await agentSessionListCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
