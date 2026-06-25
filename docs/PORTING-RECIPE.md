# cliffy → commander Conversion Recipe

**Audience:** Phase D batch agents porting command files under `src/commands/**`.

This recipe captures every mechanical transformation needed to convert a cliffy
command file to commander. Follow it in order; cross-reference PORT_PLAN.md §3
Phase D for batch-level context.

---

## 0. Module ownership convention

Each command module owns its own **name**, **alias**, and **description**.
`main.ts` simply calls `program.addCommand(mod.xyzCommand)` — it never
sets those properties on behalf of a child module.

```ts
// BEFORE (cliffy — name/alias set on the parent chain in main.ts)
export const issueCommand = new Command()
  .description("Manage issues")

// AFTER (commander — module owns name + alias)
import { Command } from "commander"

export const issueCommand = new Command("issue")
  .alias("i")
  .description("Manage issues")
```

Group commands that contain only subcommands (no own action) must still
define `.action(() => cmd.help())` so `linear issue` without a subcommand
prints help instead of silently exiting.

---

## 1. Imports

```ts
// BEFORE
import { Command, EnumType } from "@cliffy/command"

// AFTER
import { Command, Option, InvalidArgumentError } from "commander"
```

---

## 2. Action signature reorder — CRITICAL (S1 risk)

Cliffy passes **options first**, then positional arguments.  
Commander passes **positional arguments first**, then the options object,
then the Command instance.

```ts
// BEFORE (cliffy)
.action(async (options, id: string) => {
  const { team } = options
  // ...
})

// AFTER (commander)
.action(async (id: string, options, _cmd) => {
  const { team } = options
  // ...
})
```

Type the parameters explicitly so that a missed reorder causes a compile error
rather than a silent value-swap.

For group commands that only show help (no positional args):

```ts
// BEFORE (cliffy)
.action(function () { this.showHelp() })

// AFTER (commander)
.action((_opts, cmd) => { cmd.help() })
```

---

## 3. Strip `:type` suffixes from option/argument names

cliffy encodes type info inside the name string; commander uses separate
mechanisms.

```ts
// BEFORE
.option("--team <team:string>", "Team key")
.option("-l, --limit <limit:number>", "Max results", { default: 50 })

// AFTER
.option("--team <team>", "Team key")
.addOption(new Option("-l, --limit <limit>", "Max results").argParser(Number).default(50))  // numeric: see §4
```

---

## 4. Defaults — 3rd argument of `.option()`

For a STRING option, the default is the 3rd argument:

```ts
// BEFORE (cliffy)            // AFTER (commander)
.option("--team <t:string>", "Team", { default: "ENG" })
.option("--team <t>", "Team", "ENG")
```

⚠️ For a NUMERIC option with a default you MUST combine a parser with a numeric
default, otherwise `options.limit` is the STRING `"50"` by default and a string
from user input (commander does not coerce). Do NOT use a bare string default
for numbers:

```ts
// BEFORE (cliffy)
.option("--limit <n:number>", "Limit", { default: 50 })

// AFTER (commander) — parser + typed default together:
.addOption(new Option("--limit <n>", "Limit").argParser(Number).default(50))
// (bare `.option("--limit <n>", "Limit", "50")` is WRONG — yields a string)
```

---

## 5. Numeric arguments — `.argParser(Number)`

cliffy coerced `:number` automatically; commander does not.

```ts
// BEFORE
.option("-l, --limit <n:number>", "Limit")

// AFTER
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

## 6. `collect: true` → accumulator argParser

```ts
// BEFORE (cliffy)
.option("-s, --state <state:state>", "State (repeatable)", {
  default: ["unstarted"],
  collect: true,
})

// AFTER (commander)
.option("-s, --state <state>", "State (repeatable)", (val, prev: string[] = []) => [...prev, val])
// Set the initial default separately:
.option(...)  // commander initialises prev=undefined on first call so [] seed works
```

To preserve cliffy's typed default you can also write:

```ts
new Option("-s, --state <state>", "State (repeatable)")
  .argParser((val, prev: string[] = []) => [...prev, val])
  .default(["unstarted"])
```

---

## 7. Required options — `.requiredOption()`

```ts
// BEFORE
.option("--name <name:string>", "Name", { required: true })

// AFTER
.requiredOption("--name <name>", "Name")
```

---

## 8. Required vs optional positional arguments

```ts
// BEFORE (cliffy) — <arg> is required, [arg] is optional
.arguments("<id:string>")
.arguments("[id:string]")

// AFTER (commander — same angle-bracket convention)
.argument("<id>")
.argument("[id]")
```

---

## 9. Hidden options — `new Option().hideHelp()`

```ts
// BEFORE (cliffy)
.option("--debug", "Debug mode", { hidden: true })

// AFTER (commander)
.addOption(new Option("--debug", "Debug mode").hideHelp())
```

---

## 10. EnumType / `choices()` — `new Option().choices()`

```ts
// BEFORE (cliffy)
const SortType = new EnumType(["manual", "priority"])
export const cmd = new Command()
  .type("sort", SortType)
  .option("--sort <sort:sort>", "Sort order")

// AFTER (commander)
export const cmd = new Command("...")
  .addOption(
    new Option("--sort <sort>", "Sort order").choices(["manual", "priority"])
  )
```

---

## 11. `--no-x` boolean flags — native in commander

```ts
// BEFORE (cliffy)
.option("--no-interactive", "Disable interactive mode")

// AFTER (commander) — same syntax, no change needed
.option("--no-interactive", "Disable interactive mode")
// commander automatically provides --interactive (default true) and
// sets options.interactive = false when --no-interactive is given.
```

---

## 12. ValidationError → InvalidArgumentError

```ts
// BEFORE
import { ValidationError } from "@cliffy/command"
throw new ValidationError("Bad value")

// AFTER
import { InvalidArgumentError } from "commander"
throw new InvalidArgumentError("Bad value")
```

Use the existing `ValidationError` from `../../utils/errors.ts` for
application-level validation (it is not commander's InvalidArgumentError).
Only use `InvalidArgumentError` inside `.argParser()` / `.option()` callbacks
where commander catches it and formats it as an option parse error.

---

## 13. Reading the global --workspace inside an action

The preAction hook in `main.ts` calls `setCliWorkspace(workspace)` before
every action fires, so `getCliWorkspace()` from `config.ts` is always the
simplest approach:

```ts
import { getCliWorkspace } from "../../config.ts"

.action(async (options, _cmd) => {
  const workspace = getCliWorkspace() ?? options.workspace
})
```

For deeper nesting you can also read it from the commander Command object:

```ts
.action(async (options, cmd) => {
  const workspace = cmd.optsWithGlobals<{ workspace?: string }>().workspace
})
```

Both approaches work because main.ts calls `.enablePositionalOptions()` on
the root program (allowing `--workspace` before OR after the subcommand name)
and the preAction hook uses `optsWithGlobals()` to merge the root option into
every nested command context.

---

## 14. Prompts — replace cliffy with src/utils/prompt.ts

```ts
// BEFORE
import { Select, Input, Confirm, Secret, Checkbox } from "@cliffy/prompt"
const answer = await Select.prompt({ message: "Pick one", options: [...] })
const text   = await Input.prompt({ message: "Enter value" })
const ok     = await Confirm.prompt({ message: "Sure?" })
const key    = await Secret.prompt({ message: "API key" })
const many   = await Checkbox.prompt({ message: "Pick many", options: [...] })

// AFTER
import { select, searchSelect, input, confirm, password, checkbox } from "../../utils/prompt.ts"
const answer = await select({ message: "Pick one", choices: [...] })
// when search: true was set on the cliffy Select:
const answer = await searchSelect({ message: "Pick one", choices: [...] })
const text   = await input({ message: "Enter value" })
const ok     = await confirm({ message: "Sure?" })
const key    = await password({ message: "API key" })
const many   = await checkbox({ message: "Pick many", choices: [...] })
```

Choice objects stay the same shape: `{ name: string, value: string }`.

⚠️ **Behaviour changes to honor (don't silently drop):**
- **Searchable Select** (`Select.prompt({ search: true })`) → `searchSelect(...)`, backed by `@inquirer/search`. `@inquirer/search` has NO `default` pre-selection — if a cliffy site relied on `default:` with `search:true`, sort the `choices` so the intended item is first.
- **Searchable Checkbox** (`Checkbox.prompt({ search: true, searchLabel })`, used in `issue-create.ts` for label selection) has **no inquirer equivalent** — `@inquirer/checkbox` cannot filter/search. The `checkbox(...)` wrapper renders the full list without a search box. This is an accepted behaviour change (label lists are normally small); do NOT pretend `search` still works. If a list is large, sort the most-likely choices first. Note the change in the command's port.
- **Secret `hint`** (`Secret.prompt({ hint })`) — `@inquirer/prompts` `password` has no `hint`; fold the hint into the `message` string (e.g. `auth-login`'s "Create one at https://…").

For `prompt([...])` batch invocations (config.ts), replace each entry with an
individual `await select(...)` / `await input(...)` call — inquirer has no
batch API.

---

## 15. Spinner — replace @std/cli/unstable-spinner with src/utils/spinner.ts

```ts
// BEFORE
const { Spinner } = await import("@std/cli/unstable-spinner")
const showSpinner = shouldShowSpinner()
const spinner = showSpinner ? new Spinner({ message: "Loading..." }) : null
spinner?.start()
// ...
spinner?.stop()

// AFTER
import { createSpinner } from "../../utils/spinner.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"

const spinner = createSpinner("Loading...", shouldShowSpinner())
spinner.start()
// ...
spinner.stop()
```

`createSpinner(text, enabled)` is always non-null — the `enabled = false` path
produces a no-op handle so you can drop the `?.` null-guards.

For the one `spinner.message =` assignment (team-delete.ts) use `spinner.text =`:

```ts
// BEFORE
spinner.message = `Moving issues... (${count}/${total})`

// AFTER
spinner.text = `Moving issues... (${count}/${total})`
```

---

## 16. Global-option positional parsing (decision made in main.ts Phase C)

`main.ts` sets `.enablePositionalOptions()` on the root `program`.  
Each group command that itself has subcommands should call `.passThroughOptions()`
to ensure `--workspace` (or any future global option) is forwarded through
multi-level nesting:

```ts
export const issueCommand = new Command("issue")
  .alias("i")
  .description("Manage issues")
  .passThroughOptions()
  .action((_opts, cmd) => cmd.help())
  .addCommand(idCommand)
  // ...
```

Leaf commands (commands with a real action and no subcommands) do NOT need
`.passThroughOptions()`.

---

## 17. Concrete before/after example — `label list`

### BEFORE (cliffy, `src/commands/label/label-list.ts`)

```ts
import { Command } from "@cliffy/command"

export const listCommand = new Command()
  .name("list")
  .description("List issue labels")
  .option("--team <teamKey:string>", "Filter by team")
  .option("--workspace", "Show only workspace-level labels")
  .option("--all", "Show all labels")
  .option("-j, --json", "Output as JSON")
  .action(async ({ team: teamKey, workspace, all, json }) => {
    const { Spinner } = await import("@std/cli/unstable-spinner")
    const showSpinner = !json && shouldShowSpinner()
    const spinner = showSpinner ? new Spinner() : null
    spinner?.start()
    try {
      // ...fetch labels...
      spinner?.stop()
    } catch (error) {
      spinner?.stop()
      handleError(error, "Failed to list labels")
    }
  })
```

### AFTER (commander)

```ts
import { Command } from "commander"
import { createSpinner } from "../../utils/spinner.ts"

export const listCommand = new Command("list")
  .description("List issue labels")
  .option("--team <teamKey>", "Filter by team")
  .option("--workspace", "Show only workspace-level labels")
  .option("--all", "Show all labels")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {           // ← no positional args, options is 1st
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

## 18. Concrete before/after example — `issue id` (simple leaf)

### BEFORE (cliffy)

```ts
import { Command } from "@cliffy/command"

export const idCommand = new Command()
  .name("id")
  .description("Print the issue based on the current git branch")
  .action(async (_) => {
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

### AFTER (commander)

```ts
import { Command } from "commander"

export const idCommand = new Command("id")
  .description("Print the issue based on the current git branch")
  .action(async () => {       // ← no options needed; omit params entirely
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

Key differences: `@cliffy/command` → `commander`; `name()` stays on the
export; `_` (unused cliffy options object) is simply removed since commander
omits unused trailing params.

---

## Quick-reference checklist

| Cliffy pattern | Commander equivalent |
|---|---|
| `new Command()` | `new Command("name")` |
| `.globalOption(...)` | root `.option(...)` + `preAction` hook (done in main.ts) |
| `.action((opts, arg) =>)` | `.action((arg, opts, cmd) =>)` |
| `this.showHelp()` | `cmd.help()` |
| `--opt <x:string>` | `--opt <x>` |
| `--opt <x:number>` | `--opt <x>` + `.argParser(Number)` |
| `{ default: val }` | 3rd arg of `.option()` |
| `{ collect: true }` | `(val, prev=[]) => [...prev, val]` |
| `{ required: true }` | `.requiredOption(...)` |
| `{ hidden: true }` | `new Option(...).hideHelp()` |
| `EnumType` + `.type()` | `new Option(...).choices([...])` |
| `--no-x` | `--no-x` (unchanged) |
| `ValidationError` (option parse) | `InvalidArgumentError` |
| `Select.prompt(...)` | `select(...)` from utils/prompt.ts |
| `Select.prompt({ search:true })` | `searchSelect(...)` from utils/prompt.ts |
| `Checkbox.prompt(...)` | `checkbox(...)` from utils/prompt.ts |
| `Input.prompt(...)` | `input(...)` from utils/prompt.ts |
| `Confirm.prompt(...)` | `confirm(...)` from utils/prompt.ts |
| `Secret.prompt(...)` | `password(...)` from utils/prompt.ts |
| `new Spinner()` + `?.start()` | `createSpinner(text, enabled)` + `.start()` |
| `spinner.message =` | `spinner.text =` |
