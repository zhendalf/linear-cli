import { Command } from "commander"

import { defaultCommand } from "./auth-default.ts"
import { listCommand } from "./auth-list.ts"
import { loginCommand } from "./auth-login.ts"
import { logoutCommand } from "./auth-logout.ts"
import { statusCommand } from "./auth-status.ts"
import { tokenCommand } from "./auth-token.ts"
import { whoamiCommand } from "./auth-whoami.ts"

export const authCommand = new Command("auth")
  .description("Manage Linear authentication")
  .passThroughOptions()
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(listCommand)
  .addCommand(defaultCommand)
  .addCommand(tokenCommand)
  .addCommand(whoamiCommand)
  .addCommand(statusCommand)
