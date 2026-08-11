import { expect, test } from "bun:test"
import { idCommand } from "../../../src/commands/team/team-id.ts"
import { captureOutput, snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

await snapshotTest({
  name: "Team Id Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await idCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// An empty team id is falsy, so getTeamKey() resolves to nothing even though
// the repo's own .linear.toml sets one — this reaches the no-team branch.
test("Team Id Command - no team configured points at `linear config`", async () => {
  process.env["LINEAR_TEAM_ID"] = ""

  let stderr = ""
  try {
    ;({ stderr } = await captureOutput(() => idCommand.parseAsync([], { from: "user" }), {
      canFail: true,
    }))
  } finally {
    delete process.env["LINEAR_TEAM_ID"]
  }

  expect(stderr).toContain("No team id configured")
  // Regression guard: the suggestion used to name `linear configure`, which
  // exited with "unknown command".
  expect(stderr).toContain("Run `linear config` to set a team.")
  expect(stderr).not.toContain("linear configure")
})
