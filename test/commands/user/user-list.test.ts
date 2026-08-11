import { expect, test } from "bun:test"
import { userCommand } from "../../../src/commands/user/user.ts"
import { listCommand } from "../../../src/commands/user/user-list.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// `lastSeen` stays null: it renders through `toLocaleString()`, which is
// host-timezone dependent and would make these snapshots machine-specific.
function user(overrides: Record<string, unknown>) {
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

const USERS = [
  user({
    id: "user-ada",
    name: "Ada Lovelace",
    displayName: "ada",
    email: "ada@example.com",
    initials: "AL",
    owner: true,
    admin: true,
    isMe: true,
  }),
  user({
    id: "user-bob",
    name: "Bob Guest",
    displayName: "bob",
    email: "bob@example.com",
    initials: "BG",
    guest: true,
  }),
  user({
    id: "user-carol",
    name: "Carol Carol",
    displayName: "Carol Carol",
    email: "carol@example.com",
    initials: "CC",
    active: false,
  }),
]

function usersResponse(nodes: ReturnType<typeof user>[]) {
  return {
    data: {
      viewer: {
        organization: {
          users: {
            nodes,
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  }
}

test("user list - is registered on the user command", () => {
  expect(userCommand.commands).toContain(listCommand)
})

test("user command - exposes the `u` alias", () => {
  expect(userCommand.aliases()).toContain("u")
})

await snapshotTest({
  name: "User List Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

await snapshotTest({
  name: "User List Command - Active Members",
  meta: import.meta,
  colors: false,
  args: [],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetOrganizationMembers",
        variables: { includeDisabled: false, first: 100, after: undefined },
        response: usersResponse(USERS),
      },
    ])

    try {
      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// --all must reach the API as includeDisabled: true — the client-side `active`
// filter can never widen a set the API refused to return.
await snapshotTest({
  name: "User List Command - All Includes Disabled Users",
  meta: import.meta,
  colors: false,
  args: ["--all"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetOrganizationMembers",
        variables: { includeDisabled: true, first: 100, after: undefined },
        response: usersResponse(USERS),
      },
    ])

    try {
      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// --json emits the connection shape with GraphQL field names preserved.
await snapshotTest({
  name: "User List Command - JSON",
  meta: import.meta,
  colors: false,
  args: ["--json"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetOrganizationMembers",
        variables: { includeDisabled: false },
        response: usersResponse(USERS),
      },
    ])

    try {
      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Pagination: nodes concatenate across pages, pageInfo describes the exhausted
// connection.
await snapshotTest({
  name: "User List Command - JSON Pagination",
  meta: import.meta,
  colors: false,
  args: ["--json"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetOrganizationMembers",
        variables: { includeDisabled: false, after: undefined },
        response: {
          data: {
            viewer: {
              organization: {
                users: {
                  nodes: [user({ id: "user-zoe", name: "Zoe Zebra", displayName: "zoe" })],
                  pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
                },
              },
            },
          },
        },
      },
      {
        queryName: "GetOrganizationMembers",
        variables: { includeDisabled: false, after: "cursor-1" },
        response: {
          data: {
            viewer: {
              organization: {
                users: {
                  nodes: [user({ id: "user-amy", name: "Amy Ant", displayName: "amy" })],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          },
        },
      },
    ])

    try {
      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

await snapshotTest({
  name: "User List Command - No Members",
  meta: import.meta,
  colors: false,
  args: [],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetOrganizationMembers",
        variables: { includeDisabled: false },
        response: usersResponse([]),
      },
    ])

    try {
      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

await snapshotTest({
  name: "User List Command - No Active Members",
  meta: import.meta,
  colors: false,
  args: [],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetOrganizationMembers",
        variables: { includeDisabled: false },
        response: usersResponse([user({ id: "user-old", active: false })]),
      },
    ])

    try {
      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})
