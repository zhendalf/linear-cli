import { expect, test } from "bun:test"
import { configCommand } from "../../src/commands/config.ts"

// Every suggestion in the CLI names `linear config`, but `linear configure` is
// the spelling people (and older docs) reach for first — it used to exit with
// "unknown command", so it is now an alias.
test("Config Command - `configure` is an alias for `config`", () => {
  expect(configCommand.name()).toBe("config")
  expect(configCommand.aliases()).toContain("configure")
})
