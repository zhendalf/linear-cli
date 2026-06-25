import { listCommand } from "../../../src/commands/project-update/project-update-list.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

await snapshotTest({
  name: "Project Update List Command - JSON Output",
  meta: import.meta,
  colors: false,
  args: ["550e8400-e29b-41d4-a716-446655440000", "--json"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "ListProjectUpdates",
        variables: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          first: 10,
        },
        response: {
          data: {
            project: {
              name: "JSON Project",
              slugId: "json-project",
              projectUpdates: {
                nodes: [
                  {
                    id: "project-update-1",
                    body: "Project is healthy.",
                    health: "onTrack",
                    url: "https://linear.app/test/project-update-1",
                    createdAt: "2026-02-10T09:00:00Z",
                    user: {
                      name: "alex.active",
                      displayName: "Alex Active",
                    },
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

      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
