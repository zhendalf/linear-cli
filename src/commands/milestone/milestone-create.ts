import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, handleError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { resolveProjectId } from "../../utils/linear.ts"
import { createSpinner } from "../../utils/spinner.ts"

const CreateProjectMilestone = gql(`
  mutation CreateProjectMilestone($input: ProjectMilestoneCreateInput!) {
    projectMilestoneCreate(input: $input) {
      success
      projectMilestone {
        id
        name
        targetDate
        project {
          id
          name
        }
      }
    }
  }
`)

export const createCommand = new Command("create")
  .description("Create a new project milestone")
  .requiredOption("--project <projectId>", "Project ID")
  .requiredOption("--name <name>", "Milestone name")
  .option("--description <description>", "Milestone description")
  .option("--target-date <date>", "Target date (YYYY-MM-DD)")
  .action(async (options) => {
    const { project: projectIdOrSlug, name, description, targetDate } = options
    const spinner = createSpinner("", shouldShowSpinner())
    spinner.start()

    try {
      // Resolve project slug to full UUID
      const projectId = await resolveProjectId(projectIdOrSlug)

      const client = getGraphQLClient()
      const result = await client.request(CreateProjectMilestone, {
        input: {
          projectId,
          name,
          description,
          targetDate,
        },
      })
      spinner.stop()

      if (result.projectMilestoneCreate.success) {
        const milestone = result.projectMilestoneCreate.projectMilestone
        if (milestone) {
          console.log(`✓ Created milestone: ${milestone.name}`)
          console.log(`  ID: ${milestone.id}`)
          if (milestone.targetDate) {
            console.log(`  Target Date: ${milestone.targetDate}`)
          }
          console.log(`  Project: ${milestone.project.name}`)
        }
      } else {
        throw new CliError("Failed to create milestone")
      }
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to create milestone")
    }
  })
