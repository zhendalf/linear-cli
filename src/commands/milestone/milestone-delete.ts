import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, ValidationError, handleError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { confirm } from "../../utils/prompt.ts"
import { isStdinTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const DeleteProjectMilestone = gql(`
  mutation DeleteProjectMilestone($id: String!) {
    projectMilestoneDelete(id: $id) {
      success
    }
  }
`)

export const deleteCommand = new Command("delete")
  .description("Delete a project milestone")
  .argument("<id>", "Milestone ID")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (id: string, options) => {
    const { force } = options
    // Confirmation prompt unless --force is used
    if (!force) {
      if (!isStdinTTY()) {
        throw new ValidationError("Interactive confirmation required", {
          suggestion: "Use --force to skip confirmation.",
        })
      }
      const confirmed = await confirm({
        message: `Are you sure you want to delete milestone ${id}?`,
        default: false,
      })

      if (!confirmed) {
        console.log("Deletion canceled")
        return
      }
    }

    const spinner = createSpinner("", shouldShowSpinner())
    spinner.start()

    try {
      const client = getGraphQLClient()
      const result = await client.request(DeleteProjectMilestone, {
        id,
      })
      spinner.stop()

      if (result.projectMilestoneDelete.success) {
        console.log(`✓ Deleted milestone ${id}`)
      } else {
        throw new CliError("Failed to delete milestone")
      }
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to delete milestone")
    }
  })
