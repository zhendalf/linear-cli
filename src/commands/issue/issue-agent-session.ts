import { Command } from "commander"
import { agentSessionListCommand } from "./issue-agent-session-list.ts"
import { agentSessionViewCommand } from "./issue-agent-session-view.ts"

export const agentSessionCommand = new Command("agent-session")
  .description("Manage agent sessions for an issue")
  .action((_opts, cmd) => cmd.help())
  .addCommand(agentSessionListCommand)
  .addCommand(agentSessionViewCommand)
