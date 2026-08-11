import { Command } from "commander"
import { handleError } from "../../utils/errors.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getOrganizationMembers } from "../../utils/linear.ts"
import { printMembers } from "../../utils/member-display.ts"
import { createSpinner } from "../../utils/spinner.ts"

export const listCommand = new Command("list")
  .description("List members of the workspace")
  .option("-a, --all", "Include inactive members")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const { all, json } = options
    const spinner = createSpinner("", !json && shouldShowSpinner())

    try {
      spinner.start()

      const includeDisabled = all === true
      const { nodes, pageInfo } = await getOrganizationMembers(includeDisabled)

      spinner.stop()

      const members = includeDisabled ? nodes : nodes.filter((member) => member.active)

      if (json) {
        console.log(JSON.stringify({ nodes: members, pageInfo }, null, 2))
        return
      }

      if (nodes.length === 0) {
        console.log("No members found in this workspace.")
        return
      }

      if (members.length === 0) {
        console.log(
          "No active members found in this workspace. Use --all to include inactive members.",
        )
        return
      }

      printMembers(members, "Workspace Members")
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to fetch workspace members")
    }
  })
