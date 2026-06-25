import { Command } from "commander"

import { listCommand } from "./initiative-list.ts"
import { viewCommand } from "./initiative-view.ts"
import { createCommand } from "./initiative-create.ts"
import { archiveCommand } from "./initiative-archive.ts"
import { updateCommand } from "./initiative-update.ts"
import { unarchiveCommand } from "./initiative-unarchive.ts"
import { deleteCommand } from "./initiative-delete.ts"
import { addProjectCommand } from "./initiative-add-project.ts"
import { removeProjectCommand } from "./initiative-remove-project.ts"

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
