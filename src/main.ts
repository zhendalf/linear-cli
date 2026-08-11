#!/usr/bin/env bun
/**
 * Entry point — commander shell.
 *
 * Builds the root `commander` program: registers the global `--workspace`
 * option (resolved in a preAction hook), wires up every top-level command
 * group, and dispatches via `program.parseAsync(process.argv)`.
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
import { userCommand } from "./commands/user/user.ts"

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
    // Resolve the GLOBAL `--workspace` credential selector. It may appear before
    // the subcommand (parsed by the root) or after it (parsed by whichever
    // command we injected `--workspace <slug>` onto). Walk from the action
    // command up to the root and take the first value from a command that holds
    // the GLOBAL option — i.e. the root, or a command in `injectedWorkspace`.
    // Commands that define their OWN `--workspace` (config's write-value,
    // label-list's boolean filter) carry a different meaning and are skipped, so
    // they never drive credential selection.
    let workspace: string | undefined
    for (let cmd: Command | null = actionCommand; cmd; cmd = cmd.parent) {
      if (cmd === program || injectedWorkspace.has(cmd)) {
        const value = cmd.opts().workspace
        if (typeof value === "string") {
          workspace = value
          break
        }
      }
    }
    setCliWorkspace(workspace)
  })
  // Default action when no subcommand is given — print help.
  .action(() => {
    program.help()
  })

// ---------------------------------------------------------------------------
// Register subcommands
//
// Convention (see docs/dev/COMMANDS.md):
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
//   user           → "u"
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
program.addCommand(userCommand)
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

// Make --workspace position-independent: register it on every command in the
// tree (Commander won't parse a parent option appearing after the subcommand
// name). Runs after all subcommands are attached; the preAction hook reads the
// resolved value via optsWithGlobals().
//
// Two interacting concerns:
//   1. A command may define its OWN `--workspace` (label-list's boolean scope
//      filter, config's write-value). Inject the global `--workspace <slug>`
//      onto every OTHER command, but skip a command that defines its own — only
//      that exact command keeps its meaning. Ancestors and siblings still get
//      the global, so e.g. `label --workspace acme create` works while
//      `label list --workspace` stays the boolean filter (the leaf shadows it
//      via positional/passthrough parsing below).
//   2. Group commands (those with subcommands) call `.passThroughOptions()` so
//      that, combined with the root's `.enablePositionalOptions()`, a flag
//      appearing after the leaf's name is forwarded to the leaf rather than
//      consumed by the group.
const injectedWorkspace = new Set<Command>()

// True only when the command defines `--workspace` in its own module (not one
// we injected) — i.e. it owns the flag's meaning and must not be overwritten.
function ownsWorkspaceOption(cmd: Command): boolean {
  return cmd.options.some((o) => o.long === "--workspace") && !injectedWorkspace.has(cmd)
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
    if (!ownsWorkspaceOption(sub)) {
      sub.option("--workspace <slug>", "Target workspace (uses credentials)")
      injectedWorkspace.add(sub)
    }
    addWorkspaceOptionDeep(sub)
  }
}
addWorkspaceOptionDeep(program)

await program.parseAsync(process.argv)
