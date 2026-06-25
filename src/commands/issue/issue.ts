import { Command } from "commander"
import { attachCommand } from "./issue-attach.ts"
import { commentCommand } from "./issue-comment.ts"
import { createCommand } from "./issue-create.ts"
import { deleteCommand } from "./issue-delete.ts"
import { describeCommand } from "./issue-describe.ts"
import { commitsCommand } from "./issue-commits.ts"
import { idCommand } from "./issue-id.ts"
import { linkCommand } from "./issue-link.ts"
import { mineCommand } from "./issue-mine.ts"
import { pullRequestCommand } from "./issue-pull-request.ts"
import { queryCommand } from "./issue-query.ts"
import { relationCommand } from "./issue-relation.ts"
import { agentSessionCommand } from "./issue-agent-session.ts"
import { startCommand } from "./issue-start.ts"
import { titleCommand } from "./issue-title.ts"
import { updateCommand } from "./issue-update.ts"
import { urlCommand } from "./issue-url.ts"
import { viewCommand } from "./issue-view.ts"

export const issueCommand = new Command("issue")
  .alias("i")
  .description("Manage Linear issues")
  .action((_opts, cmd) => cmd.help())
  .addCommand(idCommand)
  .addCommand(mineCommand)   // has aliases: list, l
  .addCommand(queryCommand)  // has alias: q
  .addCommand(titleCommand)
  .addCommand(startCommand)
  .addCommand(viewCommand)
  .addCommand(urlCommand)
  .addCommand(describeCommand)
  .addCommand(commitsCommand)
  .addCommand(pullRequestCommand)
  .addCommand(deleteCommand)
  .addCommand(createCommand)
  .addCommand(updateCommand)
  .addCommand(commentCommand)
  .addCommand(attachCommand)
  .addCommand(linkCommand)
  .addCommand(relationCommand)
  .addCommand(agentSessionCommand)
