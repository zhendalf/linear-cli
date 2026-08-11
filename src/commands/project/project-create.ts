import { readFile } from "node:fs/promises"
import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import type { ProjectCreateInput } from "../../__codegen__/graphql.ts"
import { CliError, handleError, NotFoundError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import {
  getAllTeams,
  getProjectLabelIdByName,
  getTeamIdByKey,
  getTeamKey,
  lookupUserId,
} from "../../utils/linear.ts"
import { collect } from "../../utils/option-parsers.ts"
import { input, select } from "../../utils/prompt.ts"
import { isNotFoundError, isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"
import { PROJECT_DESCRIPTION_MAX_LENGTH, resolveProjectDescription } from "./project-description.ts"

const CreateProject = gql(`
  mutation CreateProject($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      success
      project {
        id
        slugId
        name
        url
      }
    }
  }
`)

const GetProjectStatuses = gql(`
  query GetProjectStatuses {
    projectStatuses {
      nodes {
        id
        name
        type
      }
    }
  }
`)

const AddProjectToInitiative = gql(`
  mutation AddProjectToInitiativeForCreate($input: InitiativeToProjectCreateInput!) {
    initiativeToProjectCreate(input: $input) {
      success
    }
  }
`)

async function resolveInitiativeId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  idOrSlugOrName: string,
): Promise<string | undefined> {
  // Try as UUID first
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlugOrName)) {
    return idOrSlugOrName
  }

  // Try as slug
  const slugQuery = gql(`
    query GetInitiativeBySlugForCreate($slugId: String!) {
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
    query GetInitiativeByNameForCreate($name: String!) {
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

const PRIORITY_MAPPING: Record<string, number> = {
  none: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
}

function parsePriority(priority: string): number {
  const mapped = PRIORITY_MAPPING[priority.toLowerCase()]
  if (mapped == null) {
    throw new ValidationError(`Invalid priority: ${priority}`, {
      suggestion: "Valid values: none, urgent, high, medium, low",
    })
  }
  return mapped
}

export async function resolveProjectContent(
  content: string | undefined,
  contentFile: string | undefined,
): Promise<string | undefined> {
  if (content != null && contentFile != null) {
    throw new ValidationError("Cannot specify both --content and --content-file")
  }

  if (contentFile == null) {
    return content
  }

  try {
    return await readFile(contentFile, "utf8")
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new NotFoundError("File", contentFile)
    }
    throw new CliError(
      `Failed to read content file: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

export const createCommand = new Command("create")
  .description("Create a new Linear project")
  .option("-n, --name <name>", "Project name (required)")
  .option(
    "-d, --description <description>",
    `Project description (max ${PROJECT_DESCRIPTION_MAX_LENGTH} characters, enforced by Linear's API)`,
  )
  .option(
    "-f, --description-file <path>",
    `Read project description from file (still subject to the ${PROJECT_DESCRIPTION_MAX_LENGTH}-character API limit)`,
  )
  .option("--content <markdown>", "Project overview markdown")
  .option("--content-file <path>", "Read project overview markdown from a file")
  .option(
    "-t, --team <team>",
    "Team key (can be repeated for multiple teams)",
    (val: string, prev: string[] = []) => [...prev, val],
  )
  .option("-l, --lead <lead>", "Project lead (username, email, or @me)")
  .option(
    "-s, --status <status>",
    "Project status (planned, started, paused, completed, canceled, backlog)",
  )
  .option("--start-date <startDate>", "Start date (YYYY-MM-DD)")
  .option("--target-date <targetDate>", "Target completion date (YYYY-MM-DD)")
  .option("--priority <priority>", "Project priority (none, urgent, high, medium, low)")
  .option("--label <label>", "Project label associated with the project. May be repeated.", collect)
  .option(
    "--member <user>",
    "Project member (username, email, display name, or @me). May be repeated.",
    collect,
  )
  .option("--icon <icon>", "Project icon")
  .option("--color <color>", "Project color as a HEX string")
  .option("--initiative <initiative>", "Add to initiative immediately (ID, slug, or name)")
  .option("-i, --interactive", "Interactive mode (default if no flags provided)")
  .option("-j, --json", "Output created project as JSON")
  .action(async (options) => {
    try {
      const {
        name: providedName,
        description: providedDescription,
        descriptionFile,
        content: providedContent,
        contentFile: providedContentFile,
        team: providedTeams,
        lead: providedLead,
        status: providedStatus,
        startDate: providedStartDate,
        targetDate: providedTargetDate,
        priority: providedPriority,
        label: providedLabels,
        member: providedMembers,
        icon: providedIcon,
        color: providedColor,
        initiative: providedInitiative,
        interactive: interactiveFlag,
        json: jsonOutput,
      } = options

      // Resolve/validate these before any network calls so bad input fails fast.
      const content = await resolveProjectContent(providedContent, providedContentFile)
      const priority = providedPriority != null ? parsePriority(providedPriority) : undefined

      const client = getGraphQLClient()
      const initiative = providedInitiative
      const labels: string[] = providedLabels || []
      const members: string[] = providedMembers || []

      let name: string | undefined = providedName
      let description: string | undefined = providedDescription
      let teams: string[] = providedTeams || []
      let lead: string | undefined = providedLead
      let status: string | undefined = providedStatus
      let startDate: string | undefined = providedStartDate
      let targetDate: string | undefined = providedTargetDate

      // Determine if we should run in interactive mode
      const noFlagsProvided = !name && teams.length === 0
      const isInteractive = (noFlagsProvided || interactiveFlag) && isStdoutTTY()

      if (isInteractive) {
        console.log("\nCreate a new project\n")

        // Name (required)
        if (!name) {
          name = await input({
            message: "Project name:",
            minLength: 1,
          })
        }

        // Description (optional) — skip the prompt when --description-file was passed.
        if (!description && descriptionFile == null) {
          const descResult = await input({
            message: "Description (optional):",
          })
          description = descResult || undefined
        }

        // Team selection (required)
        if (teams.length === 0) {
          const allTeams = await getAllTeams()
          const teamOptions = allTeams.map((t) => ({
            name: `${t.name} (${t.key})`,
            value: t.key,
          }))

          // Try to get default team from config
          const defaultTeam = getTeamKey()
          const defaultIndex = defaultTeam
            ? teamOptions.findIndex((t) => t.value === defaultTeam)
            : -1

          const selectedTeam = await select({
            message: "Team:",
            choices: teamOptions,
            default: defaultIndex >= 0 ? teamOptions[defaultIndex].value : undefined,
          })
          teams = [selectedTeam]
        }

        // Status selection - get actual statuses from API
        if (!status) {
          const statusResult = await client.request(GetProjectStatuses)
          const projectStatuses = statusResult.projectStatuses?.nodes || []

          if (projectStatuses.length > 0) {
            const statusOptions = projectStatuses.map(
              (s: { id: string; name: string; type: string }) => ({
                name: s.name,
                value: s.type,
              }),
            )

            // Find default (planned) status
            const defaultStatus = statusOptions.find(
              (s: { value: string }) => s.value === "planned",
            )

            const selectedStatus = await select({
              message: "Status:",
              choices: statusOptions,
              default: defaultStatus?.value || statusOptions[0]?.value,
            })
            status = selectedStatus
          }
        }

        // Lead (optional)
        if (!lead) {
          const leadResult = await input({
            message: "Lead (username, email, or @me - press Enter to skip):",
          })
          lead = leadResult || undefined
        }

        // Start date (optional)
        if (!startDate) {
          const startDateResult = await input({
            message: "Start date (YYYY-MM-DD - press Enter to skip):",
          })
          startDate = startDateResult || undefined
        }

        // Target date (optional)
        if (!targetDate) {
          const targetDateResult = await input({
            message: "Target date (YYYY-MM-DD - press Enter to skip):",
          })
          targetDate = targetDateResult || undefined
        }
      }

      const resolvedDescription = await resolveProjectDescription(description, descriptionFile)

      // Validate required fields
      if (!name) {
        throw new ValidationError("Project name is required", {
          suggestion: "Use --name or -n flag to specify a project name.",
        })
      }

      if (teams.length === 0) {
        // Try default team from config
        const defaultTeam = getTeamKey()
        if (defaultTeam) {
          teams = [defaultTeam]
        } else {
          throw new ValidationError("At least one team is required", {
            suggestion: "Use --team or -t flag to specify a team.",
          })
        }
      }

      // Resolve team IDs
      const teamIds: string[] = []
      for (const teamKey of teams) {
        const teamId = await getTeamIdByKey(teamKey.toUpperCase())
        if (!teamId) {
          throw new NotFoundError("Team", teamKey)
        }
        teamIds.push(teamId)
      }

      // Build input - resolve all optional fields first
      let leadId: string | undefined
      if (lead) {
        leadId = await lookupUserId(lead)
        if (!leadId) {
          throw new NotFoundError("Lead", lead)
        }
      }

      let statusId: string | undefined
      if (status) {
        // Map display value to API type if needed
        const statusLower = status.toLowerCase()
        const statusTypeMapping: Record<string, string> = {
          planned: "planned",
          "in progress": "started",
          started: "started",
          paused: "paused",
          completed: "completed",
          canceled: "canceled",
          backlog: "backlog",
        }
        const apiStatusType = statusTypeMapping[statusLower]
        if (!apiStatusType) {
          throw new ValidationError(`Invalid status: ${status}`, {
            suggestion: "Valid values: planned, started, paused, completed, canceled, backlog",
          })
        }

        // Look up the actual status ID from the organization's project statuses
        const statusResult = await client.request(GetProjectStatuses)
        const projectStatuses = statusResult.projectStatuses?.nodes || []
        const matchingStatus = projectStatuses.find(
          (s: { type: string }) => s.type === apiStatusType,
        )
        if (!matchingStatus) {
          throw new NotFoundError("Project status", apiStatusType)
        }
        statusId = matchingStatus.id
      }

      const labelIds: string[] = []
      for (const label of labels) {
        const labelId = await getProjectLabelIdByName(label)
        if (!labelId) {
          throw new NotFoundError("Project label", label)
        }
        labelIds.push(labelId)
      }

      const memberIds: string[] = []
      for (const member of members) {
        const memberId = await lookupUserId(member)
        if (!memberId) {
          throw new NotFoundError("User", member)
        }
        memberIds.push(memberId)
      }

      if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        throw new ValidationError("Start date must be in YYYY-MM-DD format")
      }

      if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        throw new ValidationError("Target date must be in YYYY-MM-DD format")
      }

      const projectInput: ProjectCreateInput = {
        name,
        teamIds,
        ...(resolvedDescription != null && { description: resolvedDescription }),
        ...(content != null && { content }),
        ...(leadId && { leadId }),
        ...(statusId && { statusId }),
        ...(startDate && { startDate }),
        ...(targetDate && { targetDate }),
        ...(priority != null && { priority }),
        ...(labelIds.length > 0 && { labelIds }),
        ...(memberIds.length > 0 && { memberIds }),
        ...(providedIcon != null && { icon: providedIcon }),
        ...(providedColor != null && { color: providedColor }),
      }

      const spinner = createSpinner("", shouldShowSpinner() && !jsonOutput)
      spinner.start()

      try {
        const result = await client.request(CreateProject, { input: projectInput })

        if (!result.projectCreate.success) {
          spinner.stop()
          throw new CliError("Failed to create project")
        }

        const project = result.projectCreate.project
        spinner.stop()

        if (!project) {
          throw new CliError("Failed to create project: no project returned")
        }

        // Add to initiative if specified (before JSON output so warnings go to stderr)
        if (initiative) {
          const initiativeId = await resolveInitiativeId(client, initiative)
          if (!initiativeId) {
            console.error(`\nWarning: Initiative not found: ${initiative}`)
            console.error("Project was created but not added to initiative.")
          } else {
            try {
              const linkResult = await client.request(AddProjectToInitiative, {
                input: {
                  initiativeId,
                  projectId: project.id,
                },
              })

              if (linkResult.initiativeToProjectCreate.success && !jsonOutput) {
                console.log(`✓ Added to initiative: ${initiative}`)
              } else if (!linkResult.initiativeToProjectCreate.success) {
                console.error(`\nWarning: Failed to add project to initiative`)
              }
            } catch (error) {
              console.error(`\nWarning: Failed to add project to initiative:`, error)
            }
          }
        }

        if (jsonOutput) {
          console.log(JSON.stringify(result.projectCreate, null, 2))
        } else {
          console.log(`✓ Created project: ${project.name}`)
          console.log(`  Slug: ${project.slugId}`)
          if (project.url) {
            console.log(`  URL: ${project.url}`)
          }
        }
      } catch (error) {
        spinner.stop()
        throw error
      }
    } catch (error) {
      handleError(error, "Failed to create project")
    }
  })
