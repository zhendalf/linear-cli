import { membersCommand } from "../../../src/commands/team/team-members.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// `lastSeen` is deliberately null everywhere: it renders through
// `toLocaleString()`, which is host-timezone dependent and would make these
// snapshots machine-specific.
function member(overrides: Record<string, unknown>) {
  return {
    id: "user-1",
    name: "Ada Lovelace",
    displayName: "ada",
    email: "ada@example.com",
    active: true,
    initials: "AL",
    description: null,
    timezone: null,
    lastSeen: null,
    statusEmoji: null,
    statusLabel: null,
    guest: false,
    isAssignable: true,
    admin: false,
    owner: false,
    isMe: false,
    ...overrides,
  }
}

const MEMBERS = [
  member({
    id: "user-ada",
    name: "Ada Lovelace",
    displayName: "ada",
    email: "ada@example.com",
    initials: "AL",
    description: "Engineering",
    timezone: "Europe/London",
    admin: true,
    owner: true,
    isMe: true,
  }),
  member({
    id: "user-bob",
    name: "Bob Guest",
    displayName: "bob",
    email: "bob@example.com",
    initials: "BG",
    guest: true,
    isAssignable: false,
    statusEmoji: "🌴",
    statusLabel: "On vacation",
  }),
  member({
    id: "user-carol",
    name: "Carol Carol",
    displayName: "Carol Carol",
    email: "carol@example.com",
    initials: "CC",
    active: false,
  }),
]

function membersResponse(nodes: ReturnType<typeof member>[]) {
  return {
    data: {
      team: {
        members: {
          nodes,
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  }
}

await snapshotTest({
  name: "Team Members Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await membersCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Default run: active members only, with the role/status markers.
await snapshotTest({
  name: "Team Members Command - Active Members",
  meta: import.meta,
  colors: false,
  args: ["ENG"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetTeamMembers",
        variables: {
          teamKey: "ENG",
          includeDisabled: false,
          first: 100,
          after: undefined,
        },
        response: membersResponse(MEMBERS),
      },
    ])

    try {
      await membersCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Regression test: `--all` was a no-op because includeDisabled never reached
// the API. The mock only matches when the flag is forwarded as `true`, so this
// fails loudly if that regresses.
await snapshotTest({
  name: "Team Members Command - All Includes Disabled Users",
  meta: import.meta,
  colors: false,
  args: ["ENG", "--all"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetTeamMembers",
        variables: {
          teamKey: "ENG",
          includeDisabled: true,
          first: 100,
          after: undefined,
        },
        response: membersResponse(MEMBERS),
      },
    ])

    try {
      await membersCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// --json emits the connection shape with GraphQL field names preserved, and
// respects --all just as the human output does.
await snapshotTest({
  name: "Team Members Command - JSON",
  meta: import.meta,
  colors: false,
  args: ["ENG", "--json"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetTeamMembers",
        variables: { teamKey: "ENG", includeDisabled: false },
        response: membersResponse(MEMBERS),
      },
    ])

    try {
      await membersCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Pagination: nodes are concatenated across pages and the final page's pageInfo
// (the exhausted connection) is what --json reports.
await snapshotTest({
  name: "Team Members Command - JSON Pagination",
  meta: import.meta,
  colors: false,
  args: ["ENG", "--json"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetTeamMembers",
        variables: { teamKey: "ENG", includeDisabled: false, after: undefined },
        response: {
          data: {
            team: {
              members: {
                nodes: [member({ id: "user-zoe", name: "Zoe Zebra", displayName: "zoe" })],
                pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
              },
            },
          },
        },
      },
      {
        queryName: "GetTeamMembers",
        variables: { teamKey: "ENG", includeDisabled: false, after: "cursor-1" },
        response: {
          data: {
            team: {
              members: {
                nodes: [member({ id: "user-amy", name: "Amy Ant", displayName: "amy" })],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      },
    ])

    try {
      await membersCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

await snapshotTest({
  name: "Team Members Command - No Members",
  meta: import.meta,
  colors: false,
  args: ["ENG"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetTeamMembers",
        variables: { teamKey: "ENG", includeDisabled: false },
        response: membersResponse([]),
      },
    ])

    try {
      await membersCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Members exist but all are inactive → point the user at --all.
await snapshotTest({
  name: "Team Members Command - No Active Members",
  meta: import.meta,
  colors: false,
  args: ["ENG"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetTeamMembers",
        variables: { teamKey: "ENG", includeDisabled: false },
        response: membersResponse([member({ id: "user-old", active: false })]),
      },
    ])

    try {
      await membersCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// No team key argument and no configured team → actionable validation error
// that does NOT blame the directory name (getTeamKey never reads it).
await snapshotTest({
  name: "Team Members Command - No Team Configured",
  meta: import.meta,
  colors: false,
  args: [],
  canFail: true,
  async fn() {
    process.env["LINEAR_TEAM_ID"] = ""
    try {
      await membersCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      delete process.env["LINEAR_TEAM_ID"]
    }
  },
})
