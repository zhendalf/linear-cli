import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, handleError, NotFoundError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getAllTeams, getTeamIdByKey, getTeamKey } from "../../utils/linear.ts"
import { input, select } from "../../utils/prompt.ts"
import { isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const CreateIssueLabel = gql(`
  mutation CreateIssueLabel($input: IssueLabelCreateInput!) {
    issueLabelCreate(input: $input) {
      success
      issueLabel {
        id
        name
        color
        description
        team {
          key
          name
        }
      }
    }
  }
`)

// Common label colors from Linear's palette
const DEFAULT_COLORS = [
  { name: "Red", value: "#EB5757" },
  { name: "Orange", value: "#F2994A" },
  { name: "Yellow", value: "#F2C94C" },
  { name: "Green", value: "#27AE60" },
  { name: "Teal", value: "#0D9488" },
  { name: "Blue", value: "#2F80ED" },
  { name: "Indigo", value: "#5E6AD2" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Pink", value: "#BB6BD9" },
  { name: "Gray", value: "#6B6F76" },
]

export const createCommand = new Command("create")
  .description("Create a new issue label")
  .option("-n, --name <name>", "Label name (required)")
  .option("-c, --color <color>", "Color hex code (e.g., #EB5757)")
  .option("-d, --description <description>", "Label description")
  .option("-t, --team <teamKey>", "Team key for team-specific label (omit for workspace label)")
  .option("-i, --interactive", "Interactive mode (default if no flags provided)")
  .action(async (options) => {
    try {
      const {
        name: providedName,
        color: providedColor,
        description: providedDescription,
        team: providedTeam,
        interactive: interactiveFlag,
      } = options

      const client = getGraphQLClient()

      let name = providedName
      let color = providedColor
      let description = providedDescription
      let teamKey = providedTeam

      // Determine if we should run in interactive mode
      const noFlagsProvided = !name
      const isInteractive = (noFlagsProvided || interactiveFlag) && isStdoutTTY()

      if (isInteractive) {
        console.log("\nCreate a new label\n")

        // Name (required)
        if (!name) {
          name = await input({
            message: "Label name:",
            minLength: 1,
          })
        }

        // Color selection
        if (!color) {
          const colorOptions = [
            ...DEFAULT_COLORS.map((c) => ({
              name: `${c.name} (${c.value})`,
              value: c.value,
            })),
            { name: "Custom color", value: "custom" },
          ]

          const selectedColor = await select({
            message: "Color:",
            choices: colorOptions,
            default: DEFAULT_COLORS[6].value, // Indigo
          })

          if (selectedColor === "custom") {
            color = await input({
              message: "Enter hex color (e.g., #FF5733):",
            })
          } else {
            color = selectedColor
          }
        }

        // Description (optional)
        if (!description) {
          const desc = await input({
            message: "Description (optional):",
          })
          description = desc.trim() || undefined
        }

        // Team selection (optional)
        if (teamKey === undefined) {
          const allTeams = await getAllTeams()
          const teamOptions = [
            { name: "Workspace (shared by all teams)", value: "__workspace__" },
            ...allTeams.map((t) => ({
              name: `${t.name} (${t.key})`,
              value: t.key,
            })),
          ]

          // Try to get default team from config
          const defaultTeam = getTeamKey()
          const defaultValue = defaultTeam
            ? (teamOptions.find((t) => t.value === defaultTeam)?.value ?? "__workspace__")
            : "__workspace__"

          const selectedTeam = await select({
            message: "Team:",
            choices: teamOptions,
            default: defaultValue,
          })

          teamKey = selectedTeam === "__workspace__" ? undefined : selectedTeam
        }
      }

      // Validate required fields
      if (!name) {
        throw new ValidationError("Label name is required", {
          suggestion: "Use --name or -n flag to specify a label name.",
        })
      }

      // Validate color format if provided
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        throw new ValidationError("Color must be a valid hex code (e.g., #EB5757)")
      }

      // Default color if not provided
      if (!color) {
        color = DEFAULT_COLORS[6].value // Indigo
      }

      // Build input
      let teamId: string | undefined
      if (teamKey) {
        teamId = await getTeamIdByKey(teamKey.toUpperCase())
        if (!teamId) {
          throw new NotFoundError("Team", teamKey)
        }
      }

      const labelInput = {
        name,
        color,
        ...(description && { description }),
        ...(teamId && { teamId }),
      }

      const spinner = createSpinner("", shouldShowSpinner())
      spinner.start()

      try {
        const result = await client.request(CreateIssueLabel, { input: labelInput })

        if (!result.issueLabelCreate.success) {
          spinner.stop()
          throw new CliError("Failed to create label")
        }

        const label = result.issueLabelCreate.issueLabel
        spinner.stop()

        console.log(`✓ Created label: ${label.name}`)
        console.log(`  Color: ${label.color}`)
        if (label.description) {
          console.log(`  Description: ${label.description}`)
        }
        console.log(
          `  Scope: ${label.team?.name ? `${label.team.name} (${label.team.key})` : "Workspace"}`,
        )
      } catch (error) {
        spinner.stop()
        throw error
      }
    } catch (error) {
      handleError(error, "Failed to create label")
    }
  })
