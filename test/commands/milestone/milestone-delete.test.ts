import { deleteCommand } from "../../../src/commands/milestone/milestone-delete.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Milestone Delete Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await deleteCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test successful milestone deletion with --force flag
await snapshotTest({
  name: "Milestone Delete Command - With Force Flag",
  meta: import.meta,
  colors: false,
  args: ["milestone-123", "--force"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DeleteProjectMilestone",
        response: {
          data: {
            projectMilestoneDelete: {
              success: true,
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

// Note: Deletion failure test not included because it calls Deno.exit(1)
// which is not well-supported by the snapshot testing framework
