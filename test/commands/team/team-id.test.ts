import { expect, test } from "bun:test"
import { teamCommand } from "../../../src/commands/team/team.ts"
import { idCommand } from "../../../src/commands/team/team-id.ts"
import { captureOutput, snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Import the group even though the tests drive `idCommand` directly: bun shares
// one module registry across test files, so whether some *other* file has
// already imported `team.ts` decides if `idCommand` has a parent — and that
// changes the help usage line between `id` and `team id`. Importing it here
// pins the parent regardless of file order (and pins the registration).
test("team id - is registered on the team command", () => {
  expect(teamCommand.commands).toContain(idCommand)
})

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
