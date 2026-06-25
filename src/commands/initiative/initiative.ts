import { Command } from "commander"

import { addProjectCommand } from "./initiative-add-project.ts"
import { archiveCommand } from "./initiative-archive.ts"
import { createCommand } from "./initiative-create.ts"
import { deleteCommand } from "./initiative-delete.ts"
import { listCommand } from "./initiative-list.ts"
import { removeProjectCommand } from "./initiative-remove-project.ts"
import { unarchiveCommand } from "./initiative-unarchive.ts"
import { updateCommand } from "./initiative-update.ts"
import { viewCommand } from "./initiative-view.ts"

export const initiativeCommand = new Command("initiative")
  .alias("init")
  .description("Manage Linear initiatives")
  .action((_opts, cmd) => cmd.help())
  .addCommand(listCommand)
  .addCommand(viewCommand)
  .addCommand(createCommand)
  .addCommand(archiveCommand)
  .addCommand(updateCommand)
  .addCommand(unarchiveCommand)
  .addCommand(deleteCommand)
  .addCommand(addProjectCommand)
  .addCommand(removeProjectCommand)
