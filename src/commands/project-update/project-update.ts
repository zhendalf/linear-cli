import { Command } from "commander"
import { createCommand } from "./project-update-create.ts"
import { listCommand } from "./project-update-list.ts"

export const projectUpdateCommand = new Command("project-update")
  .alias("pu")
  .description("Manage project status updates")
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(createCommand)
  .addCommand(listCommand)
