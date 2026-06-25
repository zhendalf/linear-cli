import { Command, Option } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { resolveProjectId } from "../../utils/linear.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { createSpinner } from "../../utils/spinner.ts"
import { CliError, handleError, ValidationError } from "../../utils/errors.ts"

const UpdateProjectMilestone = gql(`
  mutation UpdateProjectMilestone($id: String!, $input: ProjectMilestoneUpdateInput!) {
    projectMilestoneUpdate(id: $id, input: $input) {
      success
      projectMilestone {
        id
        name
        targetDate
        sortOrder
        project {
          id
          name
        }
      }
    }
  }
`)

export const updateCommand = new Command("update")
  .description("Update an existing project milestone")
  .argument("<id>", "Milestone ID")
  .option("--name <name>", "Milestone name")
  .option("--description <description>", "Milestone description")
  .option("--target-date <date>", "Target date (YYYY-MM-DD)")
  .addOption(new Option("--sort-order <value>", "Sort order relative to other milestones").argParser(Number))
  .option("--project <projectId>", "Move to a different project")
  .action(
    async (
      id: string,
      options,
    ) => {
      const { name, description, targetDate, sortOrder, project: projectIdOrSlug } = options
      if (
        !name && !description && !targetDate && sortOrder == null &&
        !projectIdOrSlug
      ) {
        throw new ValidationError(
          "At least one update option must be provided",
          {
            suggestion:
              "Use --name, --description, --target-date, --sort-order, or --project",
          },
        )
      }

      const spinner = createSpinner("", shouldShowSpinner())
      spinner.start()

      try {
        const client = getGraphQLClient()
        const input: Record<string, unknown> = {}

        if (name) input.name = name
        if (description) input.description = description
        if (targetDate) input.targetDate = targetDate
        if (sortOrder != null) input.sortOrder = sortOrder
        if (projectIdOrSlug) {
          // Resolve project slug to full UUID
          input.projectId = await resolveProjectId(projectIdOrSlug)
        }

        const result = await client.request(UpdateProjectMilestone, {
          id,
          input,
        })
        spinner.stop()

        if (result.projectMilestoneUpdate.success) {
          const milestone = result.projectMilestoneUpdate.projectMilestone
          if (milestone) {
            console.log(`✓ Updated milestone: ${milestone.name}`)
            console.log(`  ID: ${milestone.id}`)
            if (milestone.targetDate) {
              console.log(`  Target Date: ${milestone.targetDate}`)
            }
            console.log(`  Sort Order: ${milestone.sortOrder}`)
            console.log(`  Project: ${milestone.project.name}`)
          }
        } else {
          throw new CliError("Failed to update milestone")
        }
      } catch (error) {
        spinner.stop()
        handleError(error, "Failed to update milestone")
      }
    },
  )
