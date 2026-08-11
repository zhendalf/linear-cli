import { expect, test } from "bun:test"
import { teamCommand } from "../../../src/commands/team/team.ts"
import { autolinksCommand } from "../../../src/commands/team/team-autolinks.ts"
import { captureOutput, snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// See team-id.test.ts: importing the group pins the parent (and so the help
// usage line) regardless of which test file bun loads first.
test("team autolinks - is registered on the team command", () => {
  expect(teamCommand.commands).toContain(autolinksCommand)
})

await snapshotTest({
  name: "Team Autolinks Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await autolinksCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// An empty team id is falsy, so getTeamKey() resolves to nothing even though
// the repo's own .linear.toml sets one — this exercises the error path before
// any `gh` subprocess is spawned.
test("Team Autolinks Command - no team configured points at `linear config`", async () => {
  process.env["LINEAR_TEAM_ID"] = ""

  let stderr = ""
  try {
    ;({ stderr } = await captureOutput(() => autolinksCommand.parseAsync([], { from: "user" }), {
      canFail: true,
    }))
  } finally {
    delete process.env["LINEAR_TEAM_ID"]
  }

  expect(stderr).toContain("No team id configured")
  expect(stderr).toContain("Run `linear config` to set a team.")
  expect(stderr).not.toContain("linear configure")
  // The team never comes from the directory name — only the flag, the env var,
  // or the config file.
  expect(stderr).not.toContain("directory name")
})
