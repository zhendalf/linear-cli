import { expect, test } from "bun:test"
import { teamCommand } from "../../../src/commands/team/team.ts"
import { statesCommand } from "../../../src/commands/team/team-states.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// Deliberately out of position order to prove the command sorts by position.
const UNSORTED_STATES = {
  data: {
    team: {
      states: {
        nodes: [
          { id: "s-done", name: "Done", type: "completed", position: 3 },
          { id: "s-backlog", name: "Backlog", type: "backlog", position: 0 },
          { id: "s-progress", name: "In Progress", type: "started", position: 2 },
          { id: "s-todo", name: "Todo", type: "unstarted", position: 1 },
        ],
      },
    },
  },
}

const EMPTY_STATES = { data: { team: { states: { nodes: [] } } } }

// The snapshot tests below drive statesCommand directly, so they cannot catch a
// missing registration on the `team` group — pin the wiring separately.
test("team states - is registered on the team command", () => {
  expect(teamCommand.commands).toContain(statesCommand)
})

await snapshotTest({
  name: "Team States Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await statesCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Table output for an explicit team key, sorted by position
await snapshotTest({
  name: "Team States Command - Table",
  meta: import.meta,
  colors: false,
  args: ["ENG"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetWorkflowStates",
        variables: { teamKey: "ENG" },
        response: UNSORTED_STATES,
      },
    ])

    try {
      await statesCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// JSON output preserves GraphQL field names under the connection's `nodes`
await snapshotTest({
  name: "Team States Command - JSON",
  meta: import.meta,
  colors: false,
  args: ["ENG", "--json"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetWorkflowStates",
        variables: { teamKey: "ENG" },
        response: UNSORTED_STATES,
      },
    ])

    try {
      await statesCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Falls back to the configured team key when the argument is omitted; the mock
// only matches when the resolved key reaches the query.
await snapshotTest({
  name: "Team States Command - Configured Team Fallback",
  meta: import.meta,
  colors: false,
  args: [],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetWorkflowStates",
          variables: { teamKey: "FALLBACK" },
          response: UNSORTED_STATES,
        },
      ],
      { LINEAR_TEAM_ID: "FALLBACK" },
    )

    try {
      await statesCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

await snapshotTest({
  name: "Team States Command - Empty",
  meta: import.meta,
  colors: false,
  args: ["ENG"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      { queryName: "GetWorkflowStates", response: EMPTY_STATES },
    ])

    try {
      await statesCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Empty workflow: JSON still emits the connection shape
await snapshotTest({
  name: "Team States Command - Empty JSON",
  meta: import.meta,
  colors: false,
  args: ["ENG", "--json"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      { queryName: "GetWorkflowStates", response: EMPTY_STATES },
    ])

    try {
      await statesCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// No team key argument and no configured team → actionable validation error.
await snapshotTest({
  name: "Team States Command - No Team Configured",
  meta: import.meta,
  colors: false,
  args: [],
  canFail: true,
  async fn() {
    // An empty team id is falsy, so getTeamKey() resolves to undefined even
    // though the repo's own .linear.toml sets one.
    process.env["LINEAR_TEAM_ID"] = ""
    try {
      await statesCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      delete process.env["LINEAR_TEAM_ID"]
    }
  },
})
