import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import type { InitiativeStatus } from "../../__codegen__/graphql.ts"
import { CliError, handleError, NotFoundError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { lookupUserId } from "../../utils/linear.ts"
import { input, select } from "../../utils/prompt.ts"
import { isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const CreateInitiative = gql(`
  mutation CreateInitiative($input: InitiativeCreateInput!) {
    initiativeCreate(input: $input) {
      success
      initiative {
        id
        slugId
        name
        url
      }
    }
  }
`)

// Initiative statuses (enum values: Planned, Active, Completed)
const INITIATIVE_STATUSES = [
  { name: "Planned", value: "Planned" },
  { name: "Active", value: "Active" },
  { name: "Completed", value: "Completed" },
]

// Common initiative colors from Linear's palette
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
  .description("Create a new Linear initiative")
  .option("-n, --name <name>", "Initiative name (required)")
  .option("-d, --description <description>", "Initiative description")
  .option("-s, --status <status>", "Status: planned, active, completed (default: planned)")
  .option("-o, --owner <owner>", "Owner (username, email, or @me for yourself)")
  .option("--target-date <targetDate>", "Target completion date (YYYY-MM-DD)")
  .option("-c, --color <color>", "Color hex code (e.g., #5E6AD2)")
  .option("--icon <icon>", "Icon name")
  .option("-i, --interactive", "Interactive mode (default if no flags provided)")
  .action(async (options) => {
    const {
      name: providedName,
      description: providedDescription,
      status: providedStatus,
      owner: providedOwner,
      targetDate: providedTargetDate,
      color: providedColor,
      icon: providedIcon,
      interactive: interactiveFlag,
    } = options

    const client = getGraphQLClient()
    const icon = providedIcon

    let name = providedName
    let description = providedDescription
    let status = providedStatus
    let owner = providedOwner
    let targetDate = providedTargetDate
    let color = providedColor

    // Determine if we should run in interactive mode
    const noFlagsProvided = !name
    const isInteractive = (noFlagsProvided || interactiveFlag) && isStdoutTTY()

    if (isInteractive) {
      console.log("\nCreate a new initiative\n")

      // Name (required)
      if (!name) {
        name = await input({
          message: "Initiative name:",
          minLength: 1,
        })
      }

      // Description (optional)
      if (!description) {
        description = await input({
          message: "Description (optional):",
        })
        if (!description) description = undefined
      }

      // Status selection
      if (!status) {
        const selectedStatus = await select({
          message: "Status:",
          choices: INITIATIVE_STATUSES,
          default: "Planned",
        })
        status = selectedStatus
      }

      // Owner (optional)
      if (!owner) {
        owner = await input({
          message: "Owner (username, email, or @me - press Enter to skip):",
        })
        if (!owner) owner = undefined
      }

      // Target date (optional)
      if (!targetDate) {
        targetDate = await input({
          message: "Target date (YYYY-MM-DD - press Enter to skip):",
        })
        if (!targetDate) targetDate = undefined
      }

      // Color selection (optional)
      if (!color) {
        const colorOptions = [
          { name: "Skip (use default)", value: "__skip__" },
          ...DEFAULT_COLORS.map((c) => ({
            name: `${c.name} (${c.value})`,
            value: c.value,
          })),
          { name: "Custom color", value: "__custom__" },
        ]

        const selectedColor = await select({
          message: "Color (optional):",
          choices: colorOptions,
          default: "__skip__",
        })

        if (selectedColor === "__custom__") {
          color = await input({
            message: "Enter hex color (e.g., #FF5733):",
          })
          // Validate after input since inquirer input wrapper doesn't have inline validate
          if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            throw new ValidationError("Color must be a valid hex code (e.g., #5E6AD2)")
          }
        } else if (selectedColor !== "__skip__") {
          color = selectedColor
        }
      }
    }

    // Validate required fields
    if (!name) {
      throw new ValidationError("Initiative name is required. Use --name or -n flag.")
    }

    // Validate status if provided (user can input lowercase, we convert to API format)
    if (status) {
      const statusLower = status.toLowerCase()
      const statusEntry = INITIATIVE_STATUSES.find((s) => s.value.toLowerCase() === statusLower)
      if (!statusEntry) {
        throw new ValidationError(
          `Invalid status: ${status}. Valid values: ${INITIATIVE_STATUSES.map((s) =>
            s.value.toLowerCase(),
          ).join(", ")}`,
        )
      }
      status = statusEntry.value
    }

    // Validate color format if provided
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new ValidationError("Color must be a valid hex code (e.g., #5E6AD2)")
    }

    // Validate target date format if provided
    if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      throw new ValidationError("Target date must be in YYYY-MM-DD format")
    }

    // Build input
    let ownerId: string | undefined
    if (owner) {
      ownerId = await lookupUserId(owner)
      if (!ownerId) {
        throw new NotFoundError("Owner", owner)
      }
    }

    const inputPayload = {
      name: name as string,
      ...(description && { description }),
      ...(status && { status: status as InitiativeStatus }),
      ...(ownerId && { ownerId }),
      ...(targetDate && { targetDate }),
      ...(color && { color }),
      ...(icon && { icon }),
    }

    const spinner = createSpinner("", shouldShowSpinner())
    spinner.start()

    try {
      const result = await client.request(CreateInitiative, { input: inputPayload })

      if (!result.initiativeCreate.success) {
        spinner.stop()
        throw new CliError("Failed to create initiative")
      }

      const initiative = result.initiativeCreate.initiative
      spinner.stop()

      console.log(`✓ Created initiative: ${initiative.name}`)
      console.log(`  Slug: ${initiative.slugId}`)
      if (initiative.url) {
        console.log(`  URL: ${initiative.url}`)
      }
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to create initiative")
    }
  })
