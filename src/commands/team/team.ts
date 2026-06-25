import { Command } from "commander"

import { idCommand } from "./team-id.ts"
import { autolinksCommand } from "./team-autolinks.ts"
import { membersCommand } from "./team-members.ts"
import { listCommand } from "./team-list.ts"
import { createCommand } from "./team-create.ts"
import { deleteCommand } from "./team-delete.ts"

export const teamCommand = new Command("team")
  .alias("t")
  .description("Manage Linear teams")
  .action((_opts, cmd) => {
    cmd.help()
  })
  .addCommand(createCommand)
  .addCommand(deleteCommand)
  .addCommand(listCommand)
  .addCommand(idCommand)
  .addCommand(autolinksCommand)
  .addCommand(membersCommand)
