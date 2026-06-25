import { Command } from "commander"
import { createCommand } from "./milestone-create.ts"
import { deleteCommand } from "./milestone-delete.ts"
import { listCommand } from "./milestone-list.ts"
import { updateCommand } from "./milestone-update.ts"
import { viewCommand } from "./milestone-view.ts"

export const milestoneCommand = new Command("milestone")
  .alias("m")
  .description("Manage Linear project milestones")
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(listCommand)
  .addCommand(viewCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand)
