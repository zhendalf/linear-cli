import { agentSessionViewCommand } from "../../../src/commands/issue/issue-agent-session-view.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

await snapshotTest({
  name: "Issue Agent Session View Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await agentSessionViewCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

await snapshotTest({
  name: "Issue Agent Session View Command - Active Session With Activities",
  meta: import.meta,
  colors: false,
  args: ["session-1"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetAgentSessionDetails",
        variables: { id: "session-1" },
        response: {
          data: {
            agentSession: {
              id: "session-1",
              status: "active",
              createdAt: "2020-01-01T10:00:00Z",
              updatedAt: "2020-01-01T10:05:00Z",
              startedAt: "2020-01-01T10:00:05Z",
              endedAt: null,
              dismissedAt: null,
              summary: "Investigating auth token refresh bug in the middleware layer",
              externalLinks: [],
              creator: { name: "Alice" },
              appUser: { name: "Linear Assistant" },
              dismissedBy: null,
              issue: {
                identifier: "ENG-412",
                title: "Fix auth token refresh",
                url: "https://linear.app/eng/issue/ENG-412",
              },
              activities: {
                nodes: [
                  {
                    id: "activity-1",
                    createdAt: "2020-01-01T10:00:05Z",
                    content: {
                      __typename: "AgentActivityThoughtContent",
                      type: "thought",
                      body: "Looking at the auth middleware code",
                    },
                  },
                  {
                    id: "activity-2",
                    createdAt: "2020-01-01T10:01:00Z",
                    content: {
                      __typename: "AgentActivityActionContent",
                      type: "action",
                      action: "read_file",
                      parameter: "src/middleware/auth.ts",
                      result: "Found token refresh logic",
                    },
                  },
                  {
                    id: "activity-3",
                    createdAt: "2020-01-01T10:02:00Z",
                    content: {
                      __typename: "AgentActivityResponseContent",
                      type: "response",
                      body: "The token refresh is failing because the expiry check uses UTC",
                    },
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

      await agentSessionViewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

await snapshotTest({
  name: "Issue Agent Session View Command - Completed Session No Activities",
  meta: import.meta,
  colors: false,
  args: ["session-2"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetAgentSessionDetails",
        variables: { id: "session-2" },
        response: {
          data: {
            agentSession: {
              id: "session-2",
              status: "complete",
              createdAt: "2020-01-01T10:00:00Z",
              updatedAt: "2020-01-01T10:30:00Z",
              startedAt: "2020-01-01T10:00:05Z",
              endedAt: "2020-01-01T10:30:00Z",
              dismissedAt: null,
              summary: "Added dark mode toggle to settings page",
              externalLinks: [
                { label: "Pull Request", url: "https://github.com/org/repo/pull/42" },
                { label: "Build", url: "https://ci.example.com/builds/1234" },
              ],
              creator: { name: "Bob" },
              appUser: { name: "Linear Assistant" },
              dismissedBy: null,
              issue: {
                identifier: "ENG-398",
                title: "Add dark mode toggle",
                url: "https://linear.app/eng/issue/ENG-398",
              },
              activities: {
                nodes: [],
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

      await agentSessionViewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

await snapshotTest({
  name: "Issue Agent Session View Command - JSON Output",
  meta: import.meta,
  colors: false,
  args: ["session-3", "--json"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetAgentSessionDetails",
        variables: { id: "session-3" },
        response: {
          data: {
            agentSession: {
              id: "session-3",
              status: "stale",
              createdAt: "2020-01-02T10:00:00Z",
              updatedAt: "2020-01-02T10:30:00Z",
              startedAt: "2020-01-02T10:00:05Z",
              endedAt: null,
              dismissedAt: null,
              summary: "Session JSON output",
              externalLinks: [
                { label: "Pull Request", url: "https://github.com/org/repo/pull/77" },
              ],
              creator: { name: "Casey" },
              appUser: { name: "Linear Assistant" },
              dismissedBy: null,
              issue: {
                identifier: "ENG-500",
                title: "JSON issue",
                url: "https://linear.app/eng/issue/ENG-500",
              },
              activities: {
                nodes: [],
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

      await agentSessionViewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
