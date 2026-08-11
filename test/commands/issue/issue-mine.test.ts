import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { mineCommand } from "../../../src/commands/issue/issue-mine.ts"
import { captureOutput, snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// Test help output
await snapshotTest({
  name: "Issue Mine Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await mineCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

test("Issue Mine Command - Filter By Label", async () => {
  const fixedNow = new Date("2026-03-30T10:00:00.000Z")
  const RealDate = Date
  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      super(value == null ? fixedNow.toISOString() : value)
    }

    static override now(): number {
      return fixedNow.getTime()
    }
  }
  globalThis.Date = MockDate as DateConstructor

  const { cleanup } = await setupMockLinearServer(
    [
      {
        queryName: "GetTeamIdByKey",
        variables: { team: "ENG" },
        response: {
          data: {
            teams: {
              nodes: [{ id: "team-eng-id" }],
            },
          },
        },
      },
      {
        queryName: "GetIssuesForState",
        response: {
          data: {
            issues: {
              nodes: [
                {
                  id: "issue-1",
                  identifier: "ENG-101",
                  title: "Fix login bug",
                  priority: 1,
                  estimate: 3,
                  assignee: { initials: "MC" },
                  state: {
                    id: "state-1",
                    name: "In Progress",
                    color: "#f2c94c",
                    type: "started",
                  },
                  labels: {
                    nodes: [
                      {
                        id: "label-1",
                        name: "Bug",
                        color: "#eb5757",
                      },
                    ],
                  },
                  inverseRelations: { nodes: [] },
                  updatedAt: "2026-03-13T10:00:00.000Z",
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      },
    ],
    { LINEAR_TEAM_ID: "ENG", LINEAR_ISSUE_SORT: "priority", NO_COLOR: "true" },
  )

  const logs: string[] = []
  const origConsoleLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await mineCommand.parseAsync(["--label", "Bug", "--team", "ENG", "--sort", "priority"], {
      from: "user",
    })

    expect(logs.join("\n") + "\n").toEqual(
      "◌   ID      TITLE         LABELS B E STATE       UPDATED    \n" +
        "⚠⚠⚠ ENG-101 Fix login bug Bug      3 In Progress 17 days ago\n",
    )
  } finally {
    console.log = origConsoleLog
    globalThis.Date = RealDate
    await cleanup()
  }
})

test("Issue Mine Command - Shows Blocked Indicator", async () => {
  const fixedNow = new Date("2026-03-30T10:00:00.000Z")
  const RealDate = Date
  class MockDate extends RealDate {
    constructor(value?: string | number | Date) {
      super(value == null ? fixedNow.toISOString() : value)
    }

    static override now(): number {
      return fixedNow.getTime()
    }
  }
  globalThis.Date = MockDate as DateConstructor

  const baseState = {
    id: "state-1",
    name: "Todo",
    color: "#e2e2e2",
    type: "unstarted",
  }

  const { cleanup } = await setupMockLinearServer(
    [
      {
        queryName: "GetTeamIdByKey",
        variables: { team: "ENG" },
        response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
      },
      {
        queryName: "GetIssuesForState",
        response: {
          data: {
            issues: {
              nodes: [
                {
                  id: "issue-blocked-by-open",
                  identifier: "ENG-200",
                  title: "Blocked by open issue",
                  priority: 0,
                  estimate: null,
                  assignee: { initials: "MC" },
                  state: baseState,
                  labels: { nodes: [] },
                  inverseRelations: {
                    nodes: [
                      {
                        id: "rel-1",
                        type: "blocks",
                        issue: {
                          id: "blocker-open",
                          identifier: "ENG-100",
                          state: { type: "started" },
                        },
                      },
                    ],
                  },
                  updatedAt: "2026-03-29T10:00:00.000Z",
                },
                {
                  id: "issue-blocked-by-done",
                  identifier: "ENG-201",
                  title: "Blocker completed",
                  priority: 0,
                  estimate: null,
                  assignee: { initials: "MC" },
                  state: baseState,
                  labels: { nodes: [] },
                  inverseRelations: {
                    nodes: [
                      {
                        id: "rel-2",
                        type: "blocks",
                        issue: {
                          id: "blocker-done",
                          identifier: "ENG-101",
                          state: { type: "completed" },
                        },
                      },
                    ],
                  },
                  updatedAt: "2026-03-29T10:00:00.000Z",
                },
                {
                  id: "issue-unrelated-relation",
                  identifier: "ENG-202",
                  title: "Has only related relation",
                  priority: 0,
                  estimate: null,
                  assignee: { initials: "MC" },
                  state: baseState,
                  labels: { nodes: [] },
                  inverseRelations: {
                    nodes: [
                      {
                        id: "rel-3",
                        type: "related",
                        issue: {
                          id: "rel-other",
                          identifier: "ENG-102",
                          state: { type: "started" },
                        },
                      },
                    ],
                  },
                  updatedAt: "2026-03-29T10:00:00.000Z",
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        },
      },
    ],
    { LINEAR_TEAM_ID: "ENG", LINEAR_ISSUE_SORT: "priority", NO_COLOR: "true" },
  )

  const logs: string[] = []
  const origConsoleLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await mineCommand.parseAsync(["--team", "ENG", "--sort", "priority"], { from: "user" })

    const output = logs.join("\n")
    // ENG-200 is blocked by an open issue → indicator present.
    // ENG-201's blocker is completed → not shown.
    // ENG-202 has only a "related" relation → not shown.
    const eng200 = output.split("\n").find((l) => l.includes("ENG-200"))!
    const eng201 = output.split("\n").find((l) => l.includes("ENG-201"))!
    const eng202 = output.split("\n").find((l) => l.includes("ENG-202"))!

    expect(eng200.includes("⊘")).toBe(true)
    expect(eng201.includes("⊘")).toBe(false)
    expect(eng202.includes("⊘")).toBe(false)
  } finally {
    console.log = origConsoleLog
    globalThis.Date = RealDate
    await cleanup()
  }
})

// ---------------------------------------------------------------------------
// Sort resolution and the no-team error
// ---------------------------------------------------------------------------

// An explicitly configured but invalid sort must error with guidance instead of
// quietly sorting by priority — so no request goes out, and the mock server has
// nothing to answer.
test("Issue Mine Command - invalid configured sort errors instead of defaulting", async () => {
  const { cleanup } = await setupMockLinearServer([], {
    LINEAR_TEAM_ID: "ENG",
    LINEAR_ISSUE_SORT: "banana",
    NO_COLOR: "true",
  })

  let stderr = ""
  try {
    ;({ stderr } = await captureOutput(
      () => mineCommand.parseAsync(["--team", "ENG"], { from: "user" }),
      { canFail: true },
    ))
  } finally {
    await cleanup()
  }

  expect(stderr).toContain('Invalid issue sort: "banana"')
  expect(stderr).toContain("manual, priority")
})

// An empty team id is falsy, so getTeamKey() resolves to nothing even though
// the repo's own .linear.toml sets one — this reaches the no-team branch.
async function runMineWithoutTeam(): Promise<string> {
  const { cleanup } = await setupMockLinearServer([], {
    LINEAR_TEAM_ID: "",
    NO_COLOR: "true",
  })
  try {
    const { stderr } = await captureOutput(() => mineCommand.parseAsync([], { from: "user" }), {
      canFail: true,
    })
    return stderr
  } finally {
    await cleanup()
  }
}

test("Issue Mine Command - no-team error suggests linear config inside a repo", async () => {
  // This test runs from the repo itself, which is a git work tree.
  const stderr = await runMineWithoutTeam()

  expect(stderr).toContain("No default team configured and no team scope provided")
  expect(stderr).toContain("Use --team <key> to specify a team")
  expect(stderr).toContain("run `linear config` to link this repository to a team")
  // The team never comes from the directory name — only the flag, the env var,
  // or the config file.
  expect(stderr).not.toContain("directory")
})

test("Issue Mine Command - no-team error omits the config hint outside a repo", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-mine-no-repo-"))
  const originalCwd = process.cwd()

  let stderr = ""
  try {
    process.chdir(tempDir)
    stderr = await runMineWithoutTeam()
  } finally {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  }

  expect(stderr).toContain("No default team configured and no team scope provided")
  expect(stderr).toContain("Use --team <key> to specify a team.")
  expect(stderr).not.toContain("linear config")
})
