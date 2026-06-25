import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { lookupUserId } from "../../utils/linear.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"
import { select, input } from "../../utils/prompt.ts"
import { CliError, handleError, NotFoundError } from "../../utils/errors.ts"

// Initiative status options from Linear API
const INITIATIVE_STATUSES = [
  { name: "Planned", value: "planned" },
  { name: "Active", value: "active" },
  { name: "Completed", value: "completed" },
  { name: "Paused", value: "paused" },
]

export const updateCommand = new Command("update")
  .description("Update a Linear initiative")
  .argument("<initiativeId>")
  .option("-n, --name <name>", "New name for the initiative")
  .option("-d, --description <description>", "New description")
  .option(
    "--status <status>",
    "New status (planned, active, completed, paused)",
  )
  .option("--owner <owner>", "New owner (username, email, or @me)")
  .option(
    "--target-date <targetDate>",
    "Target completion date (YYYY-MM-DD)",
  )
  .option("--color <color>", "Initiative color (hex, e.g., #5E6AD2)")
  .option("--icon <icon>", "Initiative icon name")
  .option("-i, --interactive", "Interactive mode for updates")
  .action(
    async (
      initiativeId: string,
      options,
    ) => {
      // Define GraphQL queries at top level for proper type inference
      const detailsQuery = gql(`
        query GetInitiativeForUpdate($id: String!) {
          initiative(id: $id) {
            id
            slugId
            name
            description
            status
            targetDate
            color
            icon
            owner {
              id
              displayName
            }
          }
        }
      `)

      const updateMutation = gql(`
        mutation UpdateInitiative($id: String!, $input: InitiativeUpdateInput!) {
          initiativeUpdate(id: $id, input: $input) {
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

      // Extract options - use let for variables that may be reassigned in interactive mode
      let name = options.name
      let description = options.description
      let status = options.status
      const owner = options.owner
      let targetDate = options.targetDate
      const color = options.color
      const icon = options.icon
      const interactive = options.interactive
      let colorHex = color
      const client = getGraphQLClient()

      // Resolve initiative ID
      const resolvedId = await resolveInitiativeId(client, initiativeId)
      if (!resolvedId) {
        throw new NotFoundError("Initiative", initiativeId)
      }

      // Get current initiative details
      let initiativeDetails
      try {
        initiativeDetails = await client.request(detailsQuery, {
          id: resolvedId,
        })
      } catch (error) {
        handleError(error, "Failed to fetch initiative details")
      }

      if (!initiativeDetails?.initiative) {
        throw new NotFoundError("Initiative", initiativeId)
      }

      const initiative = initiativeDetails.initiative

      // Interactive mode
      const isInteractive = interactive && isStdoutTTY()
      const noFlagsProvided = !name &&
        !description &&
        !status &&
        !owner &&
        !targetDate &&
        !colorHex &&
        !icon

      if (noFlagsProvided && isInteractive) {
        console.log(`\nUpdating initiative: ${initiative.name}\n`)

        // Prompt for name
        const newName = await input({
          message: "Name:",
          default: initiative.name,
        })
        if (newName !== initiative.name) {
          name = newName
        }

        // Prompt for description
        const newDescription = await input({
          message: "Description:",
          default: initiative.description || "",
        })
        if (newDescription !== (initiative.description || "")) {
          description = newDescription || undefined
        }

        // Prompt for status
        const currentStatusIndex = INITIATIVE_STATUSES.findIndex(
          (s) => s.value.toLowerCase() === initiative.status?.toLowerCase(),
        )
        const newStatus = await select({
          message: "Status:",
          choices: INITIATIVE_STATUSES,
          default: currentStatusIndex >= 0
            ? INITIATIVE_STATUSES[currentStatusIndex].value
            : undefined,
        })
        if (newStatus !== initiative.status?.toLowerCase()) {
          status = newStatus
        }

        // Prompt for target date
        const newTargetDate = await input({
          message: "Target date (YYYY-MM-DD):",
          default: initiative.targetDate || "",
        })
        if (newTargetDate !== (initiative.targetDate || "")) {
          targetDate = newTargetDate || undefined
        }

        // Prompt for color
        const newColor = await input({
          message: "Color (hex, e.g., #5E6AD2):",
          default: initiative.color || "",
        })
        if (newColor !== (initiative.color || "")) {
          colorHex = newColor || undefined
        }
      }

      // Build update input
      const inputPayload: Record<string, string | undefined> = {}

      if (name !== undefined) inputPayload.name = name
      if (description !== undefined) inputPayload.description = description
      if (status !== undefined) inputPayload.status = status.toLowerCase()
      if (targetDate !== undefined) inputPayload.targetDate = targetDate
      if (colorHex !== undefined) inputPayload.color = colorHex
      if (icon !== undefined) inputPayload.icon = icon

      if (owner !== undefined) {
        const ownerId = await lookupUserId(owner)
        if (!ownerId) {
          throw new NotFoundError("Owner", owner)
        }
        inputPayload.ownerId = ownerId
      }

      // Check if any updates to make
      if (Object.keys(inputPayload).length === 0) {
        console.log("No changes specified")
        return
      }

      const spinner = createSpinner("", shouldShowSpinner())
      spinner.start()

      // Update the initiative
      try {
        const result = await client.request(updateMutation, {
          id: resolvedId,
          input: inputPayload,
        })

        spinner.stop()

        if (!result.initiativeUpdate.success) {
          throw new CliError("Failed to update initiative")
        }

        const updated = result.initiativeUpdate.initiative
        console.log(`✓ Updated initiative: ${updated.name}`)
        if (updated.url) {
          console.log(updated.url)
        }
      } catch (error) {
        spinner.stop()
        handleError(error, "Failed to update initiative")
      }
    },
  )

async function resolveInitiativeId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  idOrSlugOrName: string,
): Promise<string | undefined> {
  // Try as UUID first
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlugOrName,
    )
  ) {
    return idOrSlugOrName
  }

  // Try as slug
  const slugQuery = gql(`
    query GetInitiativeBySlug($slugId: String!) {
      initiatives(filter: { slugId: { eq: $slugId } }) {
        nodes {
          id
          slugId
        }
      }
    }
  `)

  try {
    const result = await client.request(slugQuery, { slugId: idOrSlugOrName })
    if (result.initiatives?.nodes?.length > 0) {
      return result.initiatives.nodes[0].id
    }
  } catch {
    // Continue to name lookup
  }

  // Try as name
  const nameQuery = gql(`
    query GetInitiativeByName($name: String!) {
      initiatives(filter: { name: { eqIgnoreCase: $name } }) {
        nodes {
          id
          name
        }
      }
    }
  `)

  try {
    const result = await client.request(nameQuery, { name: idOrSlugOrName })
    if (result.initiatives?.nodes?.length > 0) {
      return result.initiatives.nodes[0].id
    }
  } catch {
    // Not found
  }

  return undefined
}
