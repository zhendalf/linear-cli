import { listCommand } from "../../../src/commands/initiative-update/initiative-update-list.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

await snapshotTest({
  name: "Initiative Update List Command - JSON Output",
  meta: import.meta,
  colors: false,
  args: ["550e8400-e29b-41d4-a716-446655440000", "--json"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "ListInitiativeUpdates",
        variables: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          first: 10,
        },
        response: {
          data: {
            initiative: {
              name: "Alpha Initiative",
              slugId: "alpha",
              initiativeUpdates: {
                nodes: [
                  {
                    id: "update-1",
                    body: "Everything is on track.",
                    health: "onTrack",
                    url: "https://linear.app/test/update-1",
                    createdAt: "2026-02-15T10:00:00Z",
                    user: {
                      name: "alex.active",
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

      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
