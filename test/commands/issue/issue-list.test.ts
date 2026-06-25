import { expect, test } from "bun:test"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { mineCommand as listCommand } from "../../../src/commands/issue/issue-mine.ts"
import { parseDateFilter } from "../../../src/utils/linear.ts"
import { ValidationError } from "../../../src/utils/errors.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// Test help output
await snapshotTest({
  name: "Issue List Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

test("Issue List Command - Filter By Label", async () => {
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

  const { cleanup } = await setupMockLinearServer([
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
                  nodes: [{
                    id: "label-1",
                    name: "Bug",
                    color: "#eb5757",
                  }],
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
  ], { LINEAR_TEAM_ID: "ENG", LINEAR_ISSUE_SORT: "priority", NO_COLOR: "true" })

  const logs: string[] = []
  const origConsoleLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await listCommand.parseAsync([
      "--label",
      "Bug",
      "--team",
      "ENG",
      "--sort",
      "priority",
    ], { from: "user" })

    expect(
      logs.join("\n") + "\n",
    ).toEqual(
      "◌   ID      TITLE         LABELS B E STATE       UPDATED    \n" +
        "⚠⚠⚠ ENG-101 Fix login bug Bug      3 In Progress 17 days ago\n",
    )
  } finally {
    console.log = origConsoleLog
    globalThis.Date = RealDate
    await cleanup()
  }
})

// parseDateFilter unit tests

test("parseDateFilter - accepts YYYY-MM-DD format", () => {
  const result = parseDateFilter("2024-01-15", "--created-after")
  const expected = new Date("2024-01-15").toISOString()
  if (result !== expected) {
    throw new Error(`Expected ${expected}, got ${result}`)
  }
})

test("parseDateFilter - accepts full ISO 8601 with time and Z", () => {
  const result = parseDateFilter("2024-01-15T09:00:00Z", "--created-after")
  if (result !== "2024-01-15T09:00:00.000Z") {
    throw new Error(`Expected 2024-01-15T09:00:00.000Z, got ${result}`)
  }
})

test("parseDateFilter - accepts ISO 8601 with timezone offset", () => {
  const result = parseDateFilter(
    "2024-01-15T09:00:00+05:30",
    "--created-after",
  )
  const expected = new Date("2024-01-15T09:00:00+05:30").toISOString()
  if (result !== expected) {
    throw new Error(`Expected ${expected}, got ${result}`)
  }
})

test('parseDateFilter - rejects permissive date string "1"', () => {
  expect(() => parseDateFilter("1", "--created-after")).toThrow(
    'Invalid date format for --created-after: "1"',
  )
})

test('parseDateFilter - rejects permissive date string "March 2024"', () => {
  expect(() => parseDateFilter("March 2024", "--updated-after")).toThrow(
    'Invalid date format for --updated-after: "March 2024"',
  )
})

test('parseDateFilter - rejects permissive date string "Jan 1"', () => {
  expect(() => parseDateFilter("Jan 1", "--created-after")).toThrow(
    'Invalid date format for --created-after: "Jan 1"',
  )
})
