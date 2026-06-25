import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { viewCommand } from "../../../src/commands/initiative/initiative-view.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"

await snapshotTest({
  name: "Initiative View Command - JSON Output",
  meta: import.meta,
  colors: false,
  args: ["550e8400-e29b-41d4-a716-446655440000", "--json"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetInitiativeDetails",
        variables: { id: "550e8400-e29b-41d4-a716-446655440000" },
        response: {
          data: {
            initiative: {
              id: "550e8400-e29b-41d4-a716-446655440000",
              slugId: "alpha",
              name: "Alpha Initiative",
              description: "Top-level initiative description.",
              status: "active",
              targetDate: "2026-05-01",
              health: "onTrack",
              color: "#10b981",
              icon: "🟢",
              url: "https://linear.app/test/initiative/alpha",
              archivedAt: null,
              createdAt: "2026-01-01T10:00:00Z",
              updatedAt: "2026-02-01T10:00:00Z",
              owner: {
                id: "owner-1",
                name: "alex.active",
                displayName: "Alex Active",
              },
              projects: {
                nodes: [
                  {
                    id: "project-1",
                    slugId: "project-a",
                    name: "Project A",
                    status: {
                      name: "In Progress",
                      type: "started",
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

      await viewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
