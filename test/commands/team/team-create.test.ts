import { describe, expect, test } from "bun:test"
import { createCommand } from "../../../src/commands/team/team-create.ts"

describe("team create command", () => {
  test("should be defined", () => {
    expect(typeof createCommand).toBe("object")
    expect(createCommand.name()).toBe("create")
  })
  test("should have correct description", () => {
    expect(createCommand.description()).toBe("Create a linear team")
  })
  test("should have expected options", () => {
    const optionNames = createCommand.options.map((opt) => opt.name())
    expect(optionNames).toContain("name")
    expect(optionNames).toContain("description")
    expect(optionNames).toContain("key")
    expect(optionNames).toContain("private")
    expect(optionNames).toContain("no-interactive")
  })
})
