import { expect, test } from "bun:test"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { queryCommand } from "../../../src/commands/issue/issue-query.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// Test help output
await snapshotTest({
  name: "Issue Query Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await queryCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Mock issue data for reuse
const mockIssueNode = {
  id: "issue-1",
  identifier: "ENG-101",
  title: "Fix login bug",
  url: "https://linear.app/test/issue/ENG-101/fix-login-bug",
  priority: 2,
  priorityLabel: "High",
  estimate: 3,
  createdAt: "2026-04-01T10:00:00.000Z",
  updatedAt: "2026-04-02T08:15:00.000Z",
  state: {
    id: "state-1",
    name: "In Progress",
    color: "#f2c94c",
    type: "started",
  },
  assignee: {
    id: "user-1",
    name: "jane.smith",
    displayName: "Jane Smith",
    initials: "JS",
  },
  team: {
    id: "team-1",
    key: "ENG",
    name: "Engineering",
  },
  project: {
    id: "project-1",
    name: "Auth Improvements",
  },
  projectMilestone: null,
  cycle: null,
  labels: {
    nodes: [
      { id: "label-1", name: "Bug", color: "#eb5757" },
    ],
  },
  inverseRelations: { nodes: [] },
}

// Test JSON output with filter mode (issues() backend)
await snapshotTest({
  name: "Issue Query Command - JSON Output",
  meta: import.meta,
  colors: false,
  args: [
    "--team",
    "ENG",
    "--state",
    "started",
    "--json",
  ],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetIssuesForQuery",
        variables: {
          filter: {
            team: { key: { eq: "ENG" } },
            state: { type: { in: ["started"] } },
          },
          sort: [
            { workflowState: { order: "Descending" } },
            { priority: { nulls: "last", order: "Descending" } },
            { manual: { nulls: "last", order: "Ascending" } },
          ],
          first: 50,
        },
        response: {
          data: {
            issues: {
              nodes: [mockIssueNode],
              pageInfo: { hasNextPage: false, endCursor: "cursor-1" },
            },
          },
        },
      },
    ], { NO_COLOR: "true" })

    try {
      await queryCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Test --search mode (searchIssues() backend) with JSON
await snapshotTest({
  name: "Issue Query Command - Search JSON Output",
  meta: import.meta,
  colors: false,
  args: [
    "--search",
    "oauth timeout",
    "--team",
    "ENG",
    "--search-comments",
    "--json",
  ],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "SearchIssues",
        variables: {
          term: "oauth timeout",
          filter: {
            team: { key: { eq: "ENG" } },
          },
          includeComments: true,
        },
        response: {
          data: {
            searchIssues: {
              nodes: [{
                ...mockIssueNode,
                metadata: { context: {}, score: 0.42 },
              }],
              pageInfo: { hasNextPage: false, endCursor: "cursor-1" },
              totalCount: 1,
            },
          },
        },
      },
    ], { NO_COLOR: "true" })

    try {
      await queryCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Test --all-teams table output shows TEAM column
test("Issue Query Command - All Teams shows TEAM column", async () => {
  const fixedNow = new Date("2026-04-03T10:00:00.000Z")
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

  const { cleanup } = await setupMockLinearServer([
    {
      queryName: "GetIssuesForQuery",
      variables: {
        sort: [
          { workflowState: { order: "Descending" } },
          { priority: { nulls: "last", order: "Descending" } },
          { manual: { nulls: "last", order: "Ascending" } },
        ],
        first: 50,
      },
      response: {
        data: {
          issues: {
            nodes: [
              {
                ...mockIssueNode,
                team: { id: "team-1", key: "ENG", name: "Engineering" },
              },
              {
                ...mockIssueNode,
                id: "issue-2",
                identifier: "FE-42",
                title: "Fix CSS bug",
                team: { id: "team-2", key: "FE", name: "Frontend" },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  ], { NO_COLOR: "true" })

  const logs: string[] = []
  const origConsoleLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await queryCommand.parseAsync(["--all-teams"], { from: "user" })

    const output = logs.join("\n")
    // Header should contain TEAM column
    expect(output.includes("TEAM")).toBe(true)
    // Should contain both team keys
    expect(output.includes("ENG")).toBe(true)
    expect(output.includes("FE")).toBe(true)
  } finally {
    console.log = origConsoleLog
    globalThis.Date = RealDate
    await cleanup()
  }
})

// Blocked indicator in table output
test("Issue Query Command - Shows Blocked Indicator", async () => {
  const fixedNow = new Date("2026-04-03T10:00:00.000Z")
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

  const { cleanup } = await setupMockLinearServer([
    {
      queryName: "GetIssuesForQuery",
      response: {
        data: {
          issues: {
            nodes: [
              {
                ...mockIssueNode,
                id: "blocked-1",
                identifier: "ENG-300",
                title: "Blocked by open",
                inverseRelations: {
                  nodes: [{
                    id: "rel-a",
                    type: "blocks",
                    issue: {
                      id: "blocker",
                      identifier: "ENG-200",
                      state: { type: "started" },
                    },
                  }],
                },
              },
              {
                ...mockIssueNode,
                id: "unblocked-1",
                identifier: "ENG-301",
                title: "Blocker done",
                inverseRelations: {
                  nodes: [{
                    id: "rel-b",
                    type: "blocks",
                    issue: {
                      id: "blocker-done",
                      identifier: "ENG-201",
                      state: { type: "canceled" },
                    },
                  }],
                },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  ], { NO_COLOR: "true" })

  const logs: string[] = []
  const origConsoleLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await queryCommand.parseAsync(["--team", "ENG", "--all-states"], { from: "user" })

    const lines = logs.join("\n").split("\n")
    const blocked = lines.find((l) => l.includes("ENG-300"))!
    const unblocked = lines.find((l) => l.includes("ENG-301"))!
    expect(blocked.includes("⊘")).toBe(true)
    expect(unblocked.includes("⊘")).toBe(false)
  } finally {
    console.log = origConsoleLog
    globalThis.Date = RealDate
    await cleanup()
  }
})

// Test validation: --team + --all-teams conflict
test("Issue Query Command - rejects --team with --all-teams", async () => {
  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  try {
    await queryCommand.parseAsync(["--team", "ENG", "--all-teams"], { from: "user" })
  } catch {
    // expected
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
  }

  expect(
    errorLogs.some((l) => l.includes("Cannot use both --team and --all-teams")),
  ).toBe(true)
})

// Test validation: --sort with --search conflict
test("Issue Query Command - rejects --sort with --search", async () => {
  const { cleanup } = await setupMockLinearServer([], {
    LINEAR_TEAM_ID: "ENG",
    NO_COLOR: "true",
  })

  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  try {
    await queryCommand.parseAsync([
      "--search",
      "foo",
      "--sort",
      "priority",
      "--team",
      "ENG",
    ], { from: "user" })
  } catch {
    // expected
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
    await cleanup()
  }

  expect(
    errorLogs.some((l) => l.includes("--sort cannot be used with --search")),
  ).toBe(true)
})

// Test validation: --search-comments without --search
test("Issue Query Command - rejects --search-comments without --search", async () => {
  const { cleanup } = await setupMockLinearServer([], {
    LINEAR_TEAM_ID: "ENG",
    NO_COLOR: "true",
  })

  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  try {
    await queryCommand.parseAsync(["--search-comments", "--team", "ENG"], { from: "user" })
  } catch {
    // expected
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
    await cleanup()
  }

  expect(
    errorLogs.some((l) => l.includes("--search-comments requires --search")),
  ).toBe(true)
})

// Test validation: --milestone without --project
test("Issue Query Command - rejects --milestone without --project", async () => {
  const { cleanup } = await setupMockLinearServer([], {
    LINEAR_TEAM_ID: "ENG",
    NO_COLOR: "true",
  })

  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  try {
    await queryCommand.parseAsync(["--milestone", "v1", "--team", "ENG"], { from: "user" })
  } catch {
    // expected
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
    await cleanup()
  }

  expect(
    errorLogs.some((l) => l.includes("--milestone requires --project")),
  ).toBe(true)
})

// Note: "no default team" error path is not tested here because
// getOption("team_id") reads from config files which can't be easily
// overridden in tests. The validation logic is covered by the code path
// and the other validation tests confirm handleError integration works.
