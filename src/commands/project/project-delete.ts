import { Command, Option } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, handleError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { resolveProjectId } from "../../utils/linear.ts"
import { confirm } from "../../utils/prompt.ts"
import { isStdinTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const DeleteProject = gql(`
  mutation DeleteProject($id: String!) {
    projectDelete(id: $id) {
      success
      entity {
        id
        name
      }
    }
  }
`)

export const deleteCommand = new Command("delete")
  .description("Delete (trash) a Linear project")
  .argument("<projectId>", "Project ID or slug")
  .option("-y, --yes", "Skip confirmation prompt")
  // Back-compat alias for the old -f/--force flag (hidden).
  .addOption(new Option("-f, --force", "Skip confirmation prompt (alias for --yes)").hideHelp())
  .action(async (projectId: string, options) => {
    const force = options.yes || options.force

    if (!force) {
      if (!isStdinTTY()) {
        throw new ValidationError("Interactive confirmation required", {
          suggestion: "Use --yes to skip confirmation.",
        })
      }
      const confirmed = await confirm({
        message: `Are you sure you want to delete project ${projectId}?`,
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
      const resolvedId = await resolveProjectId(projectId)

      const result = await client.request(DeleteProject, {
        id: resolvedId,
      })
      spinner.stop()

      if (!result.projectDelete.success) {
        throw new CliError("Failed to delete project")
      }

      const entity = result.projectDelete.entity
      const displayName = entity?.name ?? projectId
      console.log(`✓ Deleted project: ${displayName}`)
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to delete project")
    }
  })
