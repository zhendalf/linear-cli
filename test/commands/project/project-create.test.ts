import { afterAll, expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  createCommand,
  resolveProjectContent,
} from "../../../src/commands/project/project-create.ts"
import { NotFoundError, ValidationError } from "../../../src/utils/errors.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Temp file with a short description, used by the --description-file tests.
const tempDir = await mkdtemp(join(tmpdir(), "linear-cli-test-"))
const descriptionFilePath = join(tempDir, "description.md")
await writeFile(descriptionFilePath, "Short description loaded from a file.")

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

// Test help output
await snapshotTest({
  name: "Project Create Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await createCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test project create with --json output
await snapshotTest({
  name: "Project Create Command - With JSON Output",
  meta: import.meta,
  colors: false,
  args: ["--name", "JSON Test Project", "--team", "ENG", "--json"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetTeamIdByKey",
        variables: { team: "ENG" },
        response: {
          data: {
            teams: {
              nodes: [{ id: "team-eng-123" }],
            },
          },
        },
      },
      {
        queryName: "CreateProject",
        response: {
          data: {
            projectCreate: {
              success: true,
              project: {
                id: "550e8400-e29b-41d4-a716-446655440000",
                slugId: "json-test-project",
                name: "JSON Test Project",
                url: "https://linear.app/test/project/json-test-project",
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

      await createCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test project create reading description from --description-file
await snapshotTest({
  name: "Project Create Command - Description From File",
  meta: import.meta,
  colors: false,
  args: [
    "--name",
    "File Desc Project",
    "--team",
    "ENG",
    "--description-file",
    descriptionFilePath,
    "--json",
  ],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetTeamIdByKey",
        variables: { team: "ENG" },
        response: {
          data: {
            teams: {
              nodes: [{ id: "team-eng-123" }],
            },
          },
        },
      },
      {
        queryName: "CreateProject",
        variables: {
          input: {
            name: "File Desc Project",
            teamIds: ["team-eng-123"],
            description: "Short description loaded from a file.",
          },
        },
        response: {
          data: {
            projectCreate: {
              success: true,
              project: {
                id: "550e8400-e29b-41d4-a716-446655440010",
                slugId: "file-desc-project",
                name: "File Desc Project",
                url: "https://linear.app/test/project/file-desc-project",
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

      await createCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Unit tests for resolveProjectContent (the --content/--content-file helper).

test("resolveProjectContent - returns inline content when only --content given", async () => {
  const result = await resolveProjectContent("## Overview", undefined)
  expect(result).toBe("## Overview")
})

test("resolveProjectContent - reads content from file", async () => {
  const contentPath = join(tempDir, "overview.md")
  await writeFile(contentPath, "## Overview from file")
  const result = await resolveProjectContent(undefined, contentPath)
  expect(result).toBe("## Overview from file")
})

test("resolveProjectContent - rejects mutually exclusive content inputs", async () => {
  await expect(resolveProjectContent("inline", "/tmp/overview.md")).rejects.toThrow(ValidationError)
  await expect(resolveProjectContent("inline", "/tmp/overview.md")).rejects.toThrow(
    "Cannot specify both --content and --content-file",
  )
})

test("resolveProjectContent - throws NotFoundError for a missing file", async () => {
  await expect(resolveProjectContent(undefined, "/tmp/does-not-exist-xyz.md")).rejects.toThrow(
    NotFoundError,
  )
  await expect(resolveProjectContent(undefined, "/tmp/does-not-exist-xyz.md")).rejects.toThrow(
    "File not found",
  )
})

// Error-path coverage for the new create fields. These mock process.exit
// (handleError calls process.exit) and capture stderr, mirroring the
// validation-error tests in issue-query.test.ts.

// Invalid --priority is rejected before any network call.
test("Project Create Command - rejects an invalid priority", async () => {
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
    await createCommand.parseAsync(["--name", "Proj", "--team", "ENG", "--priority", "highest"], {
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
  expect(errorLogs.some((l) => l.includes("Invalid priority: highest"))).toBe(true)
})

// Both --content and --content-file together are rejected before any network call.
test("Project Create Command - rejects both --content and --content-file", async () => {
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
    await createCommand.parseAsync(
      ["--name", "Proj", "--team", "ENG", "--content", "## A", "--content-file", "overview.md"],
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
    errorLogs.some((l) => l.includes("Cannot specify both --content and --content-file")),
  ).toBe(true)
})

// A description over the 255-character cap is rejected before any mutation.
test("Project Create Command - rejects a description over the 255-character limit", async () => {
  const server = new MockLinearServer([])

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
    await createCommand.parseAsync(
      ["--name", "Proj", "--team", "ENG", "--description", "x".repeat(256)],
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
  expect(errorLogs.some((l) => l.includes("exceeds the 255-character limit"))).toBe(true)
})

// An unknown --label is reported as a NotFoundError.
test("Project Create Command - rejects an unknown project label", async () => {
  const server = new MockLinearServer([
    {
      queryName: "GetTeamIdByKey",
      variables: { team: "ENG" },
      response: { data: { teams: { nodes: [{ id: "team-eng-123" }] } } },
    },
    {
      queryName: "GetProjectLabelIdByName",
      variables: { name: "Nonexistent" },
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
    await createCommand.parseAsync(["--name", "Proj", "--team", "ENG", "--label", "Nonexistent"], {
      from: "user",
    })
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
  // Full NotFoundError message — a mock mismatch could not produce this exact text.
  expect(errorLogs.some((l) => l.includes("Project label not found: Nonexistent"))).toBe(true)
})

// An unknown --member is reported as a NotFoundError.
test("Project Create Command - rejects an unknown member", async () => {
  const server = new MockLinearServer([
    {
      queryName: "GetTeamIdByKey",
      variables: { team: "ENG" },
      response: { data: { teams: { nodes: [{ id: "team-eng-123" }] } } },
    },
    {
      queryName: "LookupUser",
      variables: { input: "ghostuser" },
      response: { data: { users: { nodes: [] } } },
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
    await createCommand.parseAsync(["--name", "Proj", "--team", "ENG", "--member", "ghostuser"], {
      from: "user",
    })
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
  // Full NotFoundError message — a mock-mismatch error would echo the variable
  // "ghostuser" but never this exact "User not found:" text.
  expect(errorLogs.some((l) => l.includes("User not found: ghostuser"))).toBe(true)
})
