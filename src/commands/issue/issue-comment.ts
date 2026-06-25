import { Command } from "commander"
import { commentAddCommand } from "./issue-comment-add.ts"
import { commentDeleteCommand } from "./issue-comment-delete.ts"
import { commentUpdateCommand } from "./issue-comment-update.ts"
import { commentListCommand } from "./issue-comment-list.ts"

export const commentCommand = new Command("comment")
  .description("Manage issue comments")
  .action((_opts, cmd) => cmd.help())
  .addCommand(commentAddCommand)
  .addCommand(commentDeleteCommand)
  .addCommand(commentUpdateCommand)
  .addCommand(commentListCommand)
