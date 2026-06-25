import { deleteCommand } from "../../../src/commands/project/project-delete.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Project Delete Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await deleteCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test successful project deletion with --force flag
await snapshotTest({
  name: "Project Delete Command - With Force Flag",
  meta: import.meta,
  colors: false,
  args: ["550e8400-e29b-41d4-a716-446655440000", "--force"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DeleteProject",
        response: {
          data: {
            projectDelete: {
              success: true,
              entity: {
                id: "550e8400-e29b-41d4-a716-446655440000",
                name: "Deleted Project",
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

      await deleteCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
