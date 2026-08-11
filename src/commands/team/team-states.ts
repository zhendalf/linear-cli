import { Command } from "commander"
import stringWidth from "string-width"
import { padDisplay } from "../../utils/display.ts"
import { ValidationError, handleError } from "../../utils/errors.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getTeamKey, getWorkflowStates } from "../../utils/linear.ts"
import { createSpinner } from "../../utils/spinner.ts"
import { applyConsoleFormat } from "../../utils/styling.ts"

export const statesCommand = new Command("states")
  .description("List workflow states for a team")
  .argument("[teamKey]", "Team key (defaults to the configured team)")
  .option("-j, --json", "Output as JSON")
  .action(async (teamKey: string | undefined, options) => {
    const { json } = options
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
      const states = await getWorkflowStates(resolvedTeamKey)
      spinner.stop()

      if (json) {
        console.log(JSON.stringify({ nodes: states }, null, 2))
        return
      }

      if (states.length === 0) {
        console.log("No workflow states found for this team.")
        return
      }

      // States arrive sorted by position; keep that order (it is meaningful).
      const NAME_WIDTH = Math.max(
        stringWidth("NAME"),
        ...states.map((state) => stringWidth(state.name)),
      )
      const TYPE_WIDTH = Math.max(
        stringWidth("TYPE"),
        ...states.map((state) => stringWidth(state.type)),
      )

      console.log(
        applyConsoleFormat(
          `%c${padDisplay("NAME", NAME_WIDTH)}%c %c${padDisplay("TYPE", TYPE_WIDTH)}%c`,
          "text-decoration: underline",
          "text-decoration: none",
          "text-decoration: underline",
          "text-decoration: none",
        ),
      )

      for (const state of states) {
        console.log(`${padDisplay(state.name, NAME_WIDTH)} ${padDisplay(state.type, TYPE_WIDTH)}`)
      }
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to fetch workflow states")
    }
  })
