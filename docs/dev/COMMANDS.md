# Command Authoring Guide

The house conventions for adding or editing a command under `src/commands/**`.
The CLI is built on [commander](https://github.com/tj/commander.js); follow the
rules below so every command behaves consistently. Read this before touching a
command file.

---

## 0. Module ownership convention

Each command module owns its own **name**, **alias**, and **description** and
exports a configured `Command`. `main.ts` simply calls
`program.addCommand(mod.xyzCommand)` — it never sets those properties on behalf
of a child module.

```ts
import { Command } from "commander"

export const issueCommand = new Command("issue")
  .alias("i")
  .description("Manage issues")
```

Group commands that contain only subcommands (no own action) must still define
`.action(() => cmd.help())` so `linear issue` without a subcommand prints help
instead of silently exiting.

---

## 1. Imports

Import what you need from commander:

```ts
import { Command, Option, InvalidArgumentError } from "commander"
```

---

## 2. Action signature order — CRITICAL

Commander passes **positional arguments first**, then the options object, then
the `Command` instance:

```ts
.action(async (id: string, options, _cmd) => {
  const { team } = options
  // ...
})
```

Type the parameters explicitly so a wrong order causes a compile error rather
than a silent value-swap.

For group commands that only show help (no positional args):

```ts
.action((_opts, cmd) => { cmd.help() })
```

---

## 3. Option and argument names

Use plain names — no embedded type suffixes:

```ts
.option("--team <team>", "Team key")
.addOption(new Option("-l, --limit <limit>", "Max results").argParser(Number).default(50)) // numeric: see §4
```

---

## 4. Defaults

For a STRING option, the default is the 3rd argument of `.option()`:

```ts
.option("--team <t>", "Team", "ENG")
```

⚠️ For a NUMERIC option with a default you MUST combine a parser with a numeric
default, otherwise `options.limit` is the STRING `"50"` (commander does not
coerce):

```ts
// parser + typed default together:
.addOption(new Option("--limit <n>", "Limit").argParser(Number).default(50))
// (a bare `.option("--limit <n>", "Limit", "50")` is WRONG — yields a string)
```

---

## 5. Numeric arguments — `.argParser(Number)`

Commander does not coerce numbers; do it explicitly:

```ts
.addOption(new Option("-l, --limit <n>", "Limit").argParser(Number))
// or inline:
.option("-l, --limit <n>", "Limit", (v) => {
  const n = Number(v)
  if (isNaN(n)) throw new InvalidArgumentError("Expected a number.")
  return n
})
```

Add the `InvalidArgumentError` import from `"commander"`.

---

## 6. Repeatable options — accumulator argParser

Use the shared helpers in `src/utils/option-parsers.ts`:

```ts
.option("-l, --label <label>", "Label (repeatable)", collect)               // free-form
.addOption(new Option("-s, --state <state>", "State (repeatable)")
  .argParser(collectEnum(ISSUE_STATE_TYPES, "state")))                       // enum-validated
```

⚠️ Two footguns:

1. NEVER put `.default([...])` on an accumulator option — commander passes the
   default as `prev` on the first user value, so explicit values APPEND to the
   default instead of replacing it (`--state x` → `["default","x"]`). Apply the
   default in the action instead:
   `const states = options.state ?? ["unstarted"]`.
2. `.choices()` does NOT combine with a custom argParser, so for a REPEATABLE
   enum option validate inside the parser (`collectEnum`), not via `.choices()`.

If you do want a typed default on an accumulator, attach it explicitly:

```ts
new Option("-s, --state <state>", "State (repeatable)")
  .argParser((val, prev: string[] = []) => [...prev, val])
  .default(["unstarted"])
```

---

## 7. Required options — `.requiredOption()`

```ts
.requiredOption("--name <name>", "Name")
```

---

## 8. Required vs optional positional arguments

Angle brackets are required, square brackets are optional:

```ts
.argument("<id>")
.argument("[id]")
```

---

## 9. Hidden options — `new Option().hideHelp()`

```ts
.addOption(new Option("--debug", "Debug mode").hideHelp())
```

---

## 10. Enumerated choices — `new Option().choices()`

```ts
.addOption(
  new Option("--sort <sort>", "Sort order").choices(["manual", "priority"])
)
```

---

## 11. `--no-x` boolean flags

```ts
.option("--no-interactive", "Disable interactive mode")
// commander automatically provides --interactive (default true) and
// sets options.interactive = false when --no-interactive is given.
```

---

## 12. Validation errors

Use the application-level `ValidationError` from `../../utils/errors.ts` for
input validation in actions. Use commander's `InvalidArgumentError` ONLY inside
`.argParser()` / `.option()` callbacks, where commander catches it and formats
it as an option parse error:

```ts
import { InvalidArgumentError } from "commander"
throw new InvalidArgumentError("Bad value")
```

---

## 13. Reading the global `--workspace` inside an action

The preAction hook in `main.ts` calls `setCliWorkspace(workspace)` before every
action fires, so `getCliWorkspace()` from `config.ts` is usually the simplest
approach:

```ts
import { getCliWorkspace } from "../../config.ts"

.action(async (options, _cmd) => {
  const workspace = getCliWorkspace() ?? options.workspace
})
```

For deeper nesting you can also read it from the commander `Command` object:

```ts
.action(async (options, cmd) => {
  const workspace = cmd.optsWithGlobals<{ workspace?: string }>().workspace
})
```

Both work because `main.ts` calls `.enablePositionalOptions()` on the root
program (allowing `--workspace` before OR after the subcommand name) and the
preAction hook uses `optsWithGlobals()` to merge the root option into every
nested command context.

---

## 14. Prompts — use `src/utils/prompt.ts`

```ts
import { select, searchSelect, input, confirm, password, checkbox } from "../../utils/prompt.ts"

const answer = await select({ message: "Pick one", choices: [...] })
const picked = await searchSelect({ message: "Pick one", choices: [...] }) // filterable
const text   = await input({ message: "Enter value" })
const ok     = await confirm({ message: "Sure?" })
const key    = await password({ message: "API key" })
const many   = await checkbox({ message: "Pick many", choices: [...] })
```

Choice objects are `{ name: string, value: string }`.

⚠️ Behaviors to keep in mind:

- **`searchSelect`** (backed by `@inquirer/search`) has no `default`
  pre-selection — sort the `choices` so the intended item is first.
- **`checkbox`** renders the full list with no search box (`@inquirer/checkbox`
  cannot filter). Label lists are normally small; for long lists, sort the
  most-likely choices first.
- **`password`** has no separate hint field — fold any hint into the `message`
  string (e.g. `auth-login`'s "Create one at https://…").

There is no batch-prompt API — issue each prompt as an individual `await`.

---

## 15. Spinners — use `src/utils/spinner.ts`

```ts
import { createSpinner } from "../../utils/spinner.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"

const spinner = createSpinner("Loading...", shouldShowSpinner())
spinner.start()
// ...
spinner.stop()
```

`createSpinner(text, enabled)` is always non-null — the `enabled = false` path
produces a no-op handle, so you never need `?.` null-guards. Update live text
with `spinner.text = "..."`.

---

## 16. Global-option positional parsing

`main.ts` sets `.enablePositionalOptions()` on the root `program`. Each group
command that itself has subcommands should call `.passThroughOptions()` so
`--workspace` (or any future global option) is forwarded through multi-level
nesting:

```ts
export const issueCommand = new Command("issue")
  .alias("i")
  .description("Manage issues")
  .passThroughOptions()
  .action((_opts, cmd) => cmd.help())
  .addCommand(idCommand)
  // ...
```

Leaf commands (a real action, no subcommands) do NOT need
`.passThroughOptions()`.

---

## 17. Example — `label list` (command with options, a spinner)

```ts
import { Command } from "commander"
import { createSpinner } from "../../utils/spinner.ts"

export const listCommand = new Command("list")
  .description("List issue labels")
  .option("--team <teamKey>", "Filter by team")
  .option("--workspace", "Show only workspace-level labels")
  .option("--all", "Show all labels")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {           // no positional args, options is 1st
    const { team: teamKey, workspace, all, json } = options
    const spinner = createSpinner("", !json && shouldShowSpinner())
    spinner.start()
    try {
      // ...fetch labels...
      spinner.stop()
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to list labels")
    }
  })
```

---

## 18. Example — `issue id` (simple leaf)

```ts
import { Command } from "commander"

export const idCommand = new Command("id")
  .description("Print the issue based on the current git branch")
  .action(async () => {       // no options needed; omit params entirely
    try {
      const resolvedId = await getIssueIdentifier()
      if (resolvedId) {
        console.log(resolvedId)
      } else {
        throw new ValidationError("Could not determine issue ID", { suggestion: "..." })
      }
    } catch (error) {
      handleError(error, "Failed to get issue ID")
    }
  })
```

---

## 19. Help-text snapshots — import the group command

Bun shares one module registry across every test file in a run, and a command's
help usage line depends on whether its group has claimed it as a parent:
`idCommand` on its own prints `Usage: id`, but once *any* test file imports
`src/commands/team/team.ts` the `addCommand(...)` call attaches the parent and
it prints `Usage: team id`. Which one you get then depends on test-file load
order, which is not the same on macOS and on CI — so the snapshot passes locally
and fails in CI (or vice versa).

Whenever a test drives a subcommand directly and snapshots `--help`, import the
group module in that same file so the parent is always attached, and pin it with
a registration assertion so the import can't be pruned as unused:

```ts
import { teamCommand } from "../../../src/commands/team/team.ts"
import { idCommand } from "../../../src/commands/team/team-id.ts"

test("team id - is registered on the team command", () => {
  expect(teamCommand.commands).toContain(idCommand)
})
```

The snapshot then records the usage line users actually see, and it records the
same one everywhere.

---

## Quick-reference checklist

| Concern | House style |
|---|---|
| Construct a command | `new Command("name")` |
| Global option | root `.option(...)` + `preAction` hook (in main.ts) |
| Action signature | `.action((arg, opts, cmd) =>)` |
| Show help | `cmd.help()` |
| String option | `--opt <x>` |
| Numeric option | `--opt <x>` + `.argParser(Number)` |
| String default | 3rd arg of `.option()` |
| Repeatable option | `collect` / `collectEnum` from utils/option-parsers.ts |
| Required option | `.requiredOption(...)` |
| Hidden option | `new Option(...).hideHelp()` |
| Enumerated choices | `new Option(...).choices([...])` |
| `--no-x` flag | `--no-x` |
| Option-parse error | `InvalidArgumentError` |
| Single-select prompt | `select(...)` from utils/prompt.ts |
| Filterable select | `searchSelect(...)` from utils/prompt.ts |
| Multi-select prompt | `checkbox(...)` from utils/prompt.ts |
| Text input | `input(...)` from utils/prompt.ts |
| Confirm | `confirm(...)` from utils/prompt.ts |
| Secret input | `password(...)` from utils/prompt.ts |
| Help-text snapshot | import the group command in the test file |
| Spinner | `createSpinner(text, enabled)` + `.start()` |
| Live spinner text | `spinner.text =` |
