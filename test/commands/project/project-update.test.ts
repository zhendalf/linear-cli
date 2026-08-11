import { expect, test } from "bun:test"
import { updateCommand } from "../../../src/commands/project/project-update.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Project Update Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test project update - name only
await snapshotTest({
  name: "Project Update Command - Update Name",
  meta: import.meta,
  colors: false,
  args: ["550e8400-e29b-41d4-a716-446655440000", "--name", "Updated Project Name"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateProject",
        response: {
          data: {
            projectUpdate: {
              success: true,
              project: {
                id: "550e8400-e29b-41d4-a716-446655440000",
                slugId: "updated-proj",
                name: "Updated Project Name",
                description: null,
                url: "https://linear.app/test/project/updated-proj",
                updatedAt: "2024-01-20T15:30:00Z",
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test project update - description
await snapshotTest({
  name: "Project Update Command - Update Description",
  meta: import.meta,
  colors: false,
  args: ["550e8400-e29b-41d4-a716-446655440001", "--description", "New project description"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateProject",
        response: {
          data: {
            projectUpdate: {
              success: true,
              project: {
                id: "550e8400-e29b-41d4-a716-446655440001",
                slugId: "proj-desc",
                name: "Test Project",
                description: "New project description",
                url: "https://linear.app/test/project/proj-desc",
                updatedAt: "2024-01-20T15:30:00Z",
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test project update - status (requires GetProjectStatuses)
await snapshotTest({
  name: "Project Update Command - Update Status",
  meta: import.meta,
  colors: false,
  args: ["550e8400-e29b-41d4-a716-446655440002", "--status", "completed"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetProjectStatuses",
        response: {
          data: {
            projectStatuses: {
              nodes: [
                {
                  id: "status-completed-id",
                  name: "Completed",
                  type: "completed",
                },
              ],
            },
          },
        },
      },
      {
        queryName: "UpdateProject",
        response: {
          data: {
            projectUpdate: {
              success: true,
              project: {
                id: "550e8400-e29b-41d4-a716-446655440002",
                slugId: "proj-status",
                name: "Test Project",
                description: null,
                url: "https://linear.app/test/project/proj-status",
                updatedAt: "2024-01-20T15:30:00Z",
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test project update - replace labels.
// The UpdateProject mock pins `input.labelIds` to exactly the resolved set, so
// an additive implementation (or a wrong set) would fail to match the mock.
await snapshotTest({
  name: "Project Update Command - Replace Labels",
  meta: import.meta,
  colors: false,
  args: ["550e8400-e29b-41d4-a716-446655440003", "--label", "Frontend", "--label", "Backend"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetProjectLabelIdByName",
        variables: { name: "Frontend" },
        response: {
          data: {
            projectLabels: {
              nodes: [{ id: "project-label-frontend", name: "Frontend" }],
            },
          },
        },
      },
      {
        queryName: "GetProjectLabelIdByName",
        variables: { name: "Backend" },
        response: {
          data: {
            projectLabels: {
              nodes: [{ id: "project-label-backend", name: "Backend" }],
            },
          },
        },
      },
      {
        queryName: "UpdateProject",
        variables: {
          id: "550e8400-e29b-41d4-a716-446655440003",
          input: {
            labelIds: ["project-label-frontend", "project-label-backend"],
          },
        },
        response: {
          data: {
            projectUpdate: {
              success: true,
              project: {
                id: "550e8400-e29b-41d4-a716-446655440003",
                slugId: "proj-labels",
                name: "Test Project",
                description: null,
                url: "https://linear.app/test/project/proj-labels",
                updatedAt: "2024-01-20T15:30:00Z",
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Case-insensitive duplicate label names collapse to a single ID.
test("Project Update Command - dedups case-insensitive labels", async () => {
  const server = new MockLinearServer([
    {
      // No `variables` → matches both "Frontend" and "frontend" lookups.
      queryName: "GetProjectLabelIdByName",
      response: {
        data: {
          projectLabels: {
            nodes: [{ id: "project-label-frontend", name: "Frontend" }],
          },
        },
      },
    },
    {
      queryName: "UpdateProject",
      variables: {
        id: "550e8400-e29b-41d4-a716-446655440004",
        input: { labelIds: ["project-label-frontend"] },
      },
      response: {
        data: {
          projectUpdate: {
            success: true,
            project: {
              id: "550e8400-e29b-41d4-a716-446655440004",
              slugId: "proj-dedup",
              name: "Test Project",
              description: null,
              url: "https://linear.app/test/project/proj-dedup",
              updatedAt: "2024-01-20T15:30:00Z",
            },
          },
        },
      },
    },
  ])

  const logs: string[] = []
  const origConsoleLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await server.start()
    process.env["LINEAR_API_KEY"] = "Bearer test-token"
    await updateCommand.parseAsync(
      ["550e8400-e29b-41d4-a716-446655440004", "--label", "Frontend", "--label", "frontend"],
      { from: "user" },
    )
  } finally {
    console.log = origConsoleLog
    await server.stop()
    delete process.env["LINEAR_API_KEY"]
  }

  // Success message only appears if the UpdateProject mock matched the deduped set.
  expect(logs.some((l) => l.includes("✓ Updated project"))).toBe(true)
})

// An unknown --label fails before the update mutation (no UpdateProject mock is
// configured, so a mutation attempt would surface a different error).
test("Project Update Command - rejects an unknown label before mutating", async () => {
  const server = new MockLinearServer([
    {
      queryName: "GetProjectLabelIdByName",
      variables: { name: "Existing" },
      response: {
        data: {
          projectLabels: {
            nodes: [{ id: "project-label-existing", name: "Existing" }],
          },
        },
      },
    },
    {
      queryName: "GetProjectLabelIdByName",
      variables: { name: "Missing" },
      response: { data: { projectLabels: { nodes: [] } } },
    },
  ])

  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  let exited = false
  try {
    await server.start()
    process.env["LINEAR_API_KEY"] = "Bearer test-token"
    await updateCommand.parseAsync(
      ["550e8400-e29b-41d4-a716-446655440005", "--label", "Existing", "--label", "Missing"],
      { from: "user" },
    )
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "EXIT") throw e
    exited = true
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
    await server.stop()
    delete process.env["LINEAR_API_KEY"]
  }

  expect(exited).toBe(true)
  expect(errorLogs.some((l) => l.includes("Project label not found: Missing"))).toBe(true)
})

// An empty/whitespace label is rejected as a validation error, not treated as
// a request to clear labels.
test("Project Update Command - rejects an empty label", async () => {
  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  let exited = false
  try {
    await updateCommand.parseAsync(["550e8400-e29b-41d4-a716-446655440006", "--label", "   "], {
      from: "user",
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "EXIT") throw e
    exited = true
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
  }

  expect(exited).toBe(true)
  expect(errorLogs.some((l) => l.includes("Project label cannot be empty"))).toBe(true)
})

// --label alone satisfies the "at least one update option" requirement.
test("Project Update Command - label alone is a valid update", async () => {
  const server = new MockLinearServer([
    {
      queryName: "GetProjectLabelIdByName",
      variables: { name: "Frontend" },
      response: {
        data: {
          projectLabels: {
            nodes: [{ id: "project-label-frontend", name: "Frontend" }],
          },
        },
      },
    },
    {
      queryName: "UpdateProject",
      variables: {
        id: "550e8400-e29b-41d4-a716-446655440007",
        input: { labelIds: ["project-label-frontend"] },
      },
      response: {
        data: {
          projectUpdate: {
            success: true,
            project: {
              id: "550e8400-e29b-41d4-a716-446655440007",
              slugId: "proj-label-only",
              name: "Test Project",
              description: null,
              url: "https://linear.app/test/project/proj-label-only",
              updatedAt: "2024-01-20T15:30:00Z",
            },
          },
        },
      },
    },
  ])

  const logs: string[] = []
  const origConsoleLog = console.log
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "))
  }

  try {
    await server.start()
    process.env["LINEAR_API_KEY"] = "Bearer test-token"
    await updateCommand.parseAsync(
      ["550e8400-e29b-41d4-a716-446655440007", "--label", "Frontend"],
      { from: "user" },
    )
  } finally {
    console.log = origConsoleLog
    await server.stop()
    delete process.env["LINEAR_API_KEY"]
  }

  expect(logs.some((l) => l.includes("✓ Updated project"))).toBe(true)
})

// No options at all still fails, and the suggestion now mentions --label.
test("Project Update Command - requires at least one option", async () => {
  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  let exited = false
  try {
    await updateCommand.parseAsync(["550e8400-e29b-41d4-a716-446655440008"], { from: "user" })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "EXIT") throw e
    exited = true
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
  }

  expect(exited).toBe(true)
  expect(errorLogs.some((l) => l.includes("At least one update option must be provided"))).toBe(
    true,
  )
  expect(errorLogs.some((l) => l.includes("--label"))).toBe(true)
})

// A description over the 255-character cap is rejected before any mutation.
test("Project Update Command - rejects a description over the 255-character limit", async () => {
  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  let exited = false
  try {
    await updateCommand.parseAsync(
      ["550e8400-e29b-41d4-a716-446655440009", "--description", "x".repeat(256)],
      { from: "user" },
    )
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "EXIT") throw e
    exited = true
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
  }

  expect(exited).toBe(true)
  expect(errorLogs.some((l) => l.includes("exceeds the 255-character limit"))).toBe(true)
})

// --description and --description-file together are rejected.
test("Project Update Command - rejects --description with --description-file", async () => {
  const errorLogs: string[] = []
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "))
  }
  const origProcessExit = process.exit
  process.exit = ((_code?: number) => {
    throw new Error("EXIT")
  }) as typeof process.exit

  let exited = false
  try {
    await updateCommand.parseAsync(
      [
        "550e8400-e29b-41d4-a716-446655440010",
        "--description",
        "inline",
        "--description-file",
        "desc.md",
      ],
      { from: "user" },
    )
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "EXIT") throw e
    exited = true
  } finally {
    console.error = origConsoleError
    process.exit = origProcessExit
  }

  expect(exited).toBe(true)
  expect(
    errorLogs.some((l) => l.includes("Cannot use --description and --description-file together")),
  ).toBe(true)
})
