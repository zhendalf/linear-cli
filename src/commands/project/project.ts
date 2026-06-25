import { Command } from "commander"
import { createCommand } from "./project-create.ts"
import { deleteCommand } from "./project-delete.ts"
import { listCommand } from "./project-list.ts"
import { updateCommand } from "./project-update.ts"
import { viewCommand } from "./project-view.ts"

export const projectCommand = new Command("project")
  .alias("p")
  .description("Manage Linear projects")
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(listCommand)
  .addCommand(viewCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand)
