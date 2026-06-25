/**
 * Entry point — commander shell.
 *
 * Ported from Deno/cliffy:
 *   - @cliffy/command  → commander@13
 *   - CompletionsCommand dropped (PORT_PLAN.md §7 locked decision)
 *   - globalOption(--workspace) + globalAction → root .option + preAction hook
 *   - .parse(Deno.args) → await program.parseAsync(process.argv)
 *
 * NOTE: command modules under src/commands/** are still cliffy until Phase D.
 * The addCommand() calls below will produce TypeScript errors (cliffy Command ≠
 * commander Command) — this is expected and clears as Phase D batches land.
 */

// Side-effect inits: config (reads .linear.toml + .env) then credentials.
// Order matters — config.init() must run before credentials so env vars set by
// .env are visible when credentials reads process.env.
import "./config.ts"
import "./credentials.ts"

import { Command } from "commander"
import pkg from "../package.json" with { type: "json" }
import { setCliWorkspace } from "./config.ts"

import { apiCommand } from "./commands/api.ts"
// Command modules (still cliffy until Phase D — type errors expected here)
import { authCommand } from "./commands/auth/auth.ts"
import { configCommand } from "./commands/config.ts"
import { cycleCommand } from "./commands/cycle/cycle.ts"
import { documentCommand } from "./commands/document/document.ts"
import { initiativeUpdateCommand } from "./commands/initiative-update/initiative-update.ts"
import { initiativeCommand } from "./commands/initiative/initiative.ts"
import { issueCommand } from "./commands/issue/issue.ts"
import { labelCommand } from "./commands/label/label.ts"
import { milestoneCommand } from "./commands/milestone/milestone.ts"
import { projectUpdateCommand } from "./commands/project-update/project-update.ts"
import { projectCommand } from "./commands/project/project.ts"
import { schemaCommand } from "./commands/schema.ts"
import { teamCommand } from "./commands/team/team.ts"

const program = new Command("linear")

program
  .version(pkg.version)
  .description(
    `Handy linear commands from the command line.

Environment Variables:
  LINEAR_DEBUG=1    Show full error details including stack traces`,
  )
  // Global --workspace option. Registered on the root here AND injected onto
  // every subcommand below (see addWorkspaceOptionDeep) — Commander does not
  // parse a parent option that appears AFTER the subcommand name, so to accept
  //   linear --workspace foo issue list   (before) AND
  //   linear issue --workspace foo list   (after)
  // the option must exist on each command. The preAction hook fires for every
  // matched action and reads the flag with optsWithGlobals(), so it resolves at
  // any nesting depth regardless of which command actually parsed it.
  .option("--workspace <slug>", "Target workspace (uses credentials)")
  .hook("preAction", (_thisCommand, actionCommand) => {
    // optsWithGlobals() merges the root program's options into the subcommand's
    // option object, so workspace is visible regardless of where it appeared.
    const opts = actionCommand.optsWithGlobals<{ workspace?: string }>()
    setCliWorkspace(opts.workspace)
  })
  // Default action when no subcommand is given — mirror cliffy behaviour.
  .action(() => {
    program.help()
  })

// ---------------------------------------------------------------------------
// Register subcommands
//
// Convention (documented in docs/PORTING-RECIPE.md):
//   Each command MODULE is responsible for its own name, alias, and
//   description. It exports a configured commander Command that
//   main.ts picks up via program.addCommand(). main.ts never sets
//   name/alias/description on behalf of a command module.
//
// Aliases are set on the child Command via cmd.alias("x") inside the
// command module file, NOT here. The table below is the authoritative
// alias list carried from cliffy until Phase D ports each module:
//
//   issue          → "i"
//   team           → "t"
//   project        → "p"
//   project-update → "pu"
//   cycle          → "cy"
//   milestone      → "m"
//   initiative     → "init"
//   initiative-update → "iu"
//   label          → "l"
// ---------------------------------------------------------------------------

program.addCommand(authCommand)
program.addCommand(issueCommand)
program.addCommand(teamCommand)
program.addCommand(projectCommand)
program.addCommand(projectUpdateCommand)
program.addCommand(cycleCommand)
program.addCommand(milestoneCommand)
program.addCommand(initiativeCommand)
program.addCommand(initiativeUpdateCommand)
program.addCommand(labelCommand)
program.addCommand(documentCommand)
program.addCommand(configCommand)
program.addCommand(schemaCommand)
program.addCommand(apiCommand)

// completions command intentionally dropped — see PORT_PLAN.md §7 locked decision.

// Make --workspace position-independent: register it on every command in the
// tree (Commander won't parse a parent option appearing after the subcommand
// name). Runs after all subcommands are attached; the preAction hook reads the
// resolved value via optsWithGlobals().
function addWorkspaceOptionDeep(cmd: Command): void {
  for (const sub of cmd.commands) {
    if (!sub.options.some((o) => o.long === "--workspace")) {
      sub.option("--workspace <slug>", "Target workspace (uses credentials)")
    }
    addWorkspaceOptionDeep(sub)
  }
}
addWorkspaceOptionDeep(program)

await program.parseAsync(process.argv)
