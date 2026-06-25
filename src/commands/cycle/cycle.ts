import { Command } from "commander"
import { listCommand } from "./cycle-list.ts"
import { viewCommand } from "./cycle-view.ts"

export const cycleCommand = new Command("cycle")
  .alias("cy")
  .description("Manage Linear team cycles")
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(listCommand)
  .addCommand(viewCommand)
