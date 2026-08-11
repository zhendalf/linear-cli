import { Command } from "commander"
import stringWidth from "string-width"
import { gql } from "../../__codegen__/gql.ts"
import { padDisplay } from "../../utils/display.ts"
import { handleError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { resolveProjectId } from "../../utils/linear.ts"
import { getConsoleSize, isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"
import { applyConsoleFormat } from "../../utils/styling.ts"

const GetProjectMilestones = gql(`
  query GetProjectMilestones($projectId: String!) {
    project(id: $projectId) {
      id
      name
      projectMilestones {
        nodes {
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
  }
`)

export const listCommand = new Command("list")
  .description("List milestones for a project")
  .requiredOption("--project <projectId>", "Project ID")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const { project: projectIdOrSlug, json } = options
    const spinner = createSpinner("", shouldShowSpinner() && !json)
    spinner.start()

    try {
      // Resolve project slug to full UUID
      const projectId = await resolveProjectId(projectIdOrSlug)

      const client = getGraphQLClient()
      const result = await client.request(GetProjectMilestones, {
        projectId,
      })
      spinner.stop()

      const milestones = result.project?.projectMilestones?.nodes || []

      // Sort milestones by targetDate (nulls last) then by name
      const sortedMilestones = milestones.sort((a, b) => {
        if (!a.targetDate && !b.targetDate) return a.name.localeCompare(b.name)
        if (!a.targetDate) return 1
        if (!b.targetDate) return -1
        const dateComparison = a.targetDate.localeCompare(b.targetDate)
        return dateComparison !== 0 ? dateComparison : a.name.localeCompare(b.name)
      })

      if (json) {
        console.log(JSON.stringify({ nodes: sortedMilestones }, null, 2))
        return
      }

      if (milestones.length === 0) {
        console.log("No milestones found for this project.")
        return
      }

      // Calculate column widths
      const { columns } = isStdoutTTY() ? getConsoleSize() : { columns: 120 }

      const ID_WIDTH = 36 // UUID format
      const TARGET_DATE_WIDTH = 12 // "YYYY-MM-DD" format or "No date"
      const PROJECT_WIDTH = Math.min(
        30,
        Math.max(
          7, // minimum width for "PROJECT" header
          ...sortedMilestones.map((m) => stringWidth(m.project.name)),
        ),
      )

      const SPACE_WIDTH = 4
      const fixed = ID_WIDTH + TARGET_DATE_WIDTH + PROJECT_WIDTH + SPACE_WIDTH
      const PADDING = 1
      const maxNameWidth = Math.max(...sortedMilestones.map((m) => stringWidth(m.name)))
      const availableWidth = Math.max(columns - PADDING - fixed, 0)
      const nameWidth = Math.min(maxNameWidth, availableWidth)

      // Print header
      const headerCells = [
        padDisplay("NAME", nameWidth),
        padDisplay("ID", ID_WIDTH),
        padDisplay("TARGET DATE", TARGET_DATE_WIDTH),
        padDisplay("PROJECT", PROJECT_WIDTH),
      ]

      let headerMsg = ""
      const headerStyles: string[] = []
      headerCells.forEach((cell, index) => {
        headerMsg += `%c${cell}`
        headerStyles.push("text-decoration: underline")
        if (index < headerCells.length - 1) {
          headerMsg += "%c %c"
          headerStyles.push("text-decoration: none")
          headerStyles.push("text-decoration: underline")
        }
      })
      console.log(applyConsoleFormat(headerMsg, ...headerStyles))

      // Print each milestone
      for (const milestone of sortedMilestones) {
        const targetDate = milestone.targetDate || "No date"
        const projectName =
          milestone.project.name.length > PROJECT_WIDTH
            ? milestone.project.name.slice(0, PROJECT_WIDTH - 3) + "..."
            : padDisplay(milestone.project.name, PROJECT_WIDTH)

        const truncName =
          milestone.name.length > nameWidth
            ? milestone.name.slice(0, nameWidth - 3) + "..."
            : padDisplay(milestone.name, nameWidth)

        console.log(
          `${truncName} ${padDisplay(milestone.id, ID_WIDTH)} ${padDisplay(
            targetDate,
            TARGET_DATE_WIDTH,
          )} ${projectName}`,
        )
      }
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to fetch milestones")
    }
  })
