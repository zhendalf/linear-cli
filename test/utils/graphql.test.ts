import { expect, test } from "bun:test"
import { setCliWorkspace } from "../../src/config.ts"
import { getResolvedApiKey } from "../../src/utils/graphql.ts"

test("getResolvedApiKey - errors when --workspace not found in credentials", () => {
  delete process.env["LINEAR_API_KEY"]
  setCliWorkspace("nonexistent-workspace-xyz-123")

  try {
    expect(() => getResolvedApiKey()).toThrow(
      'Workspace "nonexistent-workspace-xyz-123" not found in credentials',
    )
  } finally {
    setCliWorkspace(undefined)
  }
})

test("getResolvedApiKey - errors when LINEAR_API_KEY and --workspace both set", () => {
  process.env["LINEAR_API_KEY"] = "test-api-key"
  setCliWorkspace("test-workspace")

  try {
    expect(() => getResolvedApiKey()).toThrow(
      "Cannot use --workspace flag when LINEAR_API_KEY environment variable is set",
    )
  } finally {
    delete process.env["LINEAR_API_KEY"]
    setCliWorkspace(undefined)
  }
})

test("getResolvedApiKey - returns LINEAR_API_KEY when set without --workspace", () => {
  process.env["LINEAR_API_KEY"] = "test-api-key"
  setCliWorkspace(undefined)

  try {
    const result = getResolvedApiKey()
    expect(result).toBe("test-api-key")
  } finally {
    delete process.env["LINEAR_API_KEY"]
  }
})
