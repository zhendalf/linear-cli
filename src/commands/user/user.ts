import { Command } from "commander"

import { listCommand } from "./user-list.ts"

export const userCommand = new Command("user")
  .alias("u")
  .description("Manage Linear users")
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(listCommand)
