import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { commentDeleteCommand } from "../../../src/commands/issue/issue-comment-delete.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// Test deleting a comment
await snapshotTest({
  name: "Issue Comment Delete Command - Success",
  meta: import.meta,
  colors: false,
  args: ["comment-uuid-123"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "DeleteComment",
        response: {
          data: {
            commentDelete: {
              success: true,
            },
          },
        },
      },
    ])

    try {
      await commentDeleteCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})
