import { Command } from "commander"

import { createCommand } from "./initiative-update-create.ts"
import { listCommand } from "./initiative-update-list.ts"

export const initiativeUpdateCommand = new Command("initiative-update")
  .alias("iu")
  .description("Manage initiative status updates (timeline posts)")
  .action((_opts, cmd) => cmd.help())
  .addCommand(createCommand)
  .addCommand(listCommand)
