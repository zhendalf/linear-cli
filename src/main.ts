/**
 * Entry point — commander shell.
 *
 * Originally ported from Deno/cliffy (see docs/dev/ for the historical plan):
 *   - @cliffy/command  → commander@13
 *   - shell `completions` command dropped (to be revisited)
 *   - globalOption(--workspace) + globalAction → root .option + preAction hook
 *   - .parse(Deno.args) → await program.parseAsync(process.argv)
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
  // Treat the subcommand name as a positional operand: the root stops parsing
  // its own options once it reaches the subcommand, so a flag like
  // `label list --workspace` is handed to the leaf instead of being matched
  // against the root's `--workspace <slug>`. Required for command-level options
  // (e.g. label-list's boolean `--workspace` filter) to shadow the global one.
  .enablePositionalOptions()

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
    // A command may define its OWN boolean `--workspace` (e.g. label list's
    // scope filter), in which case optsWithGlobals() yields `true` — only the
    // global `--workspace <slug>` produces a string. Guard on typeof so a
    // command-level boolean filter never drives the credential selector.
    const opts = actionCommand.optsWithGlobals<{ workspace?: string | boolean }>()
    setCliWorkspace(typeof opts.workspace === "string" ? opts.workspace : undefined)
  })
  // Default action when no subcommand is given — mirror cliffy behaviour.
  .action(() => {
    program.help()
  })

// ---------------------------------------------------------------------------
// Register subcommands
//
// Convention (see docs/dev/PORTING-RECIPE.md):
//   Each command MODULE is responsible for its own name, alias, and
//   description. It exports a configured commander Command that
//   main.ts picks up via program.addCommand(). main.ts never sets
//   name/alias/description on behalf of a command module.
//
// Aliases are set on the child Command via cmd.alias("x") inside the
// command module file, NOT here. The table below is the authoritative
// alias list:
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

// completions command intentionally dropped during the port (to be revisited).

// Make --workspace position-independent: register it on every command in the
// tree (Commander won't parse a parent option appearing after the subcommand
// name). Runs after all subcommands are attached; the preAction hook reads the
// resolved value via optsWithGlobals().
//
// Two interacting concerns:
//   1. A command may define its OWN `--workspace` (e.g. label-list's boolean
//      scope filter). It must keep that meaning, so we never inject the global
//      `--workspace <slug>` onto a command whose subtree already defines its
//      own `--workspace`. The leaf keeps its boolean; group ancestors stay
//      clean so the flag isn't intercepted on the way down.
//   2. Group commands (those with subcommands) call `.passThroughOptions()` so
//      that, combined with the root's `.enablePositionalOptions()`, a flag
//      appearing after the leaf's name is forwarded to the leaf rather than
//      consumed by the group.
const injectedWorkspace = new Set<Command>()

function subtreeDefinesOwnWorkspace(cmd: Command): boolean {
  if (cmd.options.some((o) => o.long === "--workspace") && !injectedWorkspace.has(cmd)) {
    return true
  }
  return cmd.commands.some(subtreeDefinesOwnWorkspace)
}

function addWorkspaceOptionDeep(cmd: Command): void {
  for (const sub of cmd.commands) {
    if (sub.commands.length > 0) {
      // Group command: stop parsing its own options at the subcommand operand
      // (enablePositionalOptions) and forward any later flags to the matched
      // leaf (passThroughOptions). Both are required together, and the parent
      // of any passThrough command must itself have positional options enabled.
      sub.enablePositionalOptions()
      sub.passThroughOptions()
    }
    if (!subtreeDefinesOwnWorkspace(sub)) {
      sub.option("--workspace <slug>", "Target workspace (uses credentials)")
      injectedWorkspace.add(sub)
    }
    addWorkspaceOptionDeep(sub)
  }
}
addWorkspaceOptionDeep(program)

await program.parseAsync(process.argv)
