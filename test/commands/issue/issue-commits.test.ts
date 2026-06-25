import { commitsCommand } from "../../../src/commands/issue/issue-commits.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Issue Commits Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await commitsCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})
