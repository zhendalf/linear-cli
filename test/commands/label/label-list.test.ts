import { listCommand } from "../../../src/commands/label/label-list.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

await snapshotTest({
  name: "Label List Command - JSON Output",
  meta: import.meta,
  colors: false,
  args: ["--all", "--json"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetIssueLabels",
        variables: { filter: undefined, first: 100, after: undefined },
        response: {
          data: {
            issueLabels: {
              nodes: [
                {
                  id: "label-2",
                  name: "backend",
                  description: "Backend label",
                  color: "#00ff00",
                  team: {
                    key: "ENG",
                    name: "Engineering",
                  },
                },
                {
                  id: "label-1",
                  name: "bug",
                  description: "Bug label",
                  color: "#ff0000",
                  team: null,
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
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

await snapshotTest({
  name: "Label List Command - Empty JSON Output",
  meta: import.meta,
  colors: false,
  args: ["--all", "--json"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetIssueLabels",
        variables: { filter: undefined, first: 100, after: undefined },
        response: {
          data: {
            issueLabels: {
              nodes: [],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
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

      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
