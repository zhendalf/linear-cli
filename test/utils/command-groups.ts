/**
 * Imported for side effects, to make command help output deterministic.
 *
 * Command modules export module-level singletons (`export const listCommand =
 * new Command("list")`), and each group module registers them via
 * `.addCommand(...)`. `addCommand` MUTATES the child: it sets the child's
 * parent, and commander walks that parent chain to build the "Usage:" line.
 *
 * So a subcommand's own help renders as "Usage: list" when its group module was
 * never imported, and "Usage: team list" once anything in the process imports
 * it. Since bun runs the whole suite in one process, that made help snapshots
 * depend on WHICH files were selected and in what order they loaded — a test
 * asserting registration (`expect(teamCommand.commands).toContain(...)`) has to
 * import its group, which silently reparented every sibling's help output.
 * `bun test <one-file>` and `bun test` then disagreed, and the failure moved
 * between commands depending on load order (it landed on `team id` locally and
 * `team list` in CI).
 *
 * Importing every group here, from the shared snapshot helper, pins the parent
 * chain to the same shape it has in production: always attached. Snapshots then
 * match `linear <group> <command> --help` modulo the program name, and no
 * future registration assertion can shift a sibling's output.
 *
 * NOTE: import the group modules, never `src/main.ts` — main.ts calls
 * `program.parseAsync()` and injects `--workspace` onto every command at import
 * time, so importing it from tests would run the CLI and change help output.
 */

import "../../src/commands/auth/auth.ts"
import "../../src/commands/cycle/cycle.ts"
import "../../src/commands/document/document.ts"
import "../../src/commands/initiative-update/initiative-update.ts"
import "../../src/commands/initiative/initiative.ts"
import "../../src/commands/issue/issue.ts"
import "../../src/commands/label/label.ts"
import "../../src/commands/milestone/milestone.ts"
import "../../src/commands/project-update/project-update.ts"
import "../../src/commands/project/project.ts"
import "../../src/commands/team/team.ts"
import "../../src/commands/user/user.ts"
