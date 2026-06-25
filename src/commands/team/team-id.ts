import { Command } from "commander"
import { getTeamKey } from "../../utils/linear.ts"
import { handleError, ValidationError } from "../../utils/errors.ts"

export const idCommand = new Command("id")
  .description("Print the configured team id")
  .action(() => {
    try {
      const teamId = getTeamKey()
      if (teamId) {
        console.log(teamId)
      } else {
        throw new ValidationError(
          "No team id configured",
          { suggestion: "Run `linear configure` to set a team." },
        )
      }
    } catch (error) {
      handleError(error, "Failed to get team id")
    }
  })
