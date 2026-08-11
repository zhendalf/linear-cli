import { Command } from "commander"
import { ValidationError, handleError } from "../../utils/errors.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getTeamKey, getTeamMembers } from "../../utils/linear.ts"
import { printMembers } from "../../utils/member-display.ts"
import { createSpinner } from "../../utils/spinner.ts"

export const membersCommand = new Command("members")
  .description("List team members")
  .argument("[teamKey]", "Team key")
  .option("-a, --all", "Include inactive members")
  .option("-j, --json", "Output as JSON")
  .action(async (teamKey: string | undefined, options) => {
    const { all, json } = options
    const spinner = createSpinner("", !json && shouldShowSpinner())

    try {
      const resolvedTeamKey = teamKey || getTeamKey()
      if (!resolvedTeamKey) {
        throw new ValidationError("Could not determine team key", {
          suggestion:
            "Pass a team key as an argument, or set `team_id` in .linear.toml (run `linear config`).",
        })
      }

      spinner.start()

      // Disabled users are excluded by the API unless we ask for them, so the
      // flag has to reach the query — a client-side `active` filter alone can
      // never widen the set.
      const includeDisabled = all === true
      const { nodes, pageInfo } = await getTeamMembers(resolvedTeamKey, includeDisabled)

      spinner.stop()

      // --json is an output format, not a raw dump: it must respect --all just
      // as the human output does.
      const members = includeDisabled ? nodes : nodes.filter((member) => member.active)

      if (json) {
        console.log(JSON.stringify({ nodes: members, pageInfo }, null, 2))
        return
      }

      if (nodes.length === 0) {
        console.log("No members found for this team.")
        return
      }

      if (members.length === 0) {
        console.log("No active members found for this team. Use --all to include inactive members.")
        return
      }

      printMembers(members, "Team Members")
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to fetch team members")
    }
  })
