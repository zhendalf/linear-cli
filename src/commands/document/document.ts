import { Command } from "commander"
import { listCommand } from "./document-list.ts"
import { viewCommand } from "./document-view.ts"
import { createCommand } from "./document-create.ts"
import { updateCommand } from "./document-update.ts"
import { deleteCommand } from "./document-delete.ts"

export const documentCommand = new Command("document")
  .alias("docs")
  .alias("doc")
  .description("Manage Linear documents")
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(listCommand)
  .addCommand(viewCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand)
