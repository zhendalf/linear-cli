import { Command } from "commander"
import { listCommand } from "./label-list.ts"
import { createCommand } from "./label-create.ts"
import { deleteCommand } from "./label-delete.ts"

export const labelCommand = new Command("label")
  .alias("l")
  .description("Manage Linear issue labels")
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(listCommand)
  .addCommand(createCommand)
  .addCommand(deleteCommand)
