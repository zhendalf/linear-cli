import { readFile } from "node:fs/promises"
import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { readIdsFromStdin } from "../../utils/bulk.ts"
import { getEditor, openEditor } from "../../utils/editor.ts"
import { CliError, handleError, NotFoundError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { resolveProjectId } from "../../utils/linear.ts"
import { input, select } from "../../utils/prompt.ts"
import { isNotFoundError, isStdinTTY, isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

type ProjectUpdateHealth = "onTrack" | "atRisk" | "offTrack"

/**
 * Read content from stdin if available (piped input)
 */
async function readContentFromStdin(): Promise<string | undefined> {
  // Check if stdin has data (not a TTY)
  if (isStdinTTY()) {
    return undefined
  }

  try {
    const lines = await readIdsFromStdin()
    // Join back with newlines since it's content, not IDs
    const content = lines.join("\n")
    return content.length > 0 ? content : undefined
  } catch {
    return undefined
  }
}

const CreateProjectUpdate = gql(`
  mutation CreateProjectUpdate($input: ProjectUpdateCreateInput!) {
    projectUpdateCreate(input: $input) {
      success
      projectUpdate {
        id
        body
        health
        url
        createdAt
        project {
          name
          slugId
        }
      }
    }
  }
`)

export const createCommand = new Command("create")
  .description("Create a new status update for a project")
  .alias("c")
  .argument("<projectId>", "Project ID or slug")
  .option("--body <body>", "Update content (inline)")
  .option("--body-file <path>", "Read content from file")
  .option("--health <health>", "Project health status (onTrack, atRisk, offTrack)")
  .option("-i, --interactive", "Interactive mode with prompts")
  .action(async (projectId: string, options) => {
    const { body, bodyFile, health, interactive } = options
    const client = getGraphQLClient()

    try {
      // Resolve project ID
      const resolvedProjectId = await resolveProjectId(projectId)

      // Determine if we should use interactive mode
      let useInteractive = interactive && isStdoutTTY()

      // If no flags provided and is TTY, enter interactive mode
      const noFlagsProvided = !body && !bodyFile && !health
      if (noFlagsProvided && isStdoutTTY() && isStdinTTY()) {
        useInteractive = true
      }

      // Interactive mode
      if (useInteractive) {
        const result = await promptInteractiveCreate()

        const updateInput: {
          projectId: string
          body?: string
          health?: ProjectUpdateHealth
        } = {
          projectId: resolvedProjectId,
        }

        if (result.body) {
          updateInput.body = result.body
        }

        if (result.health) {
          updateInput.health = result.health
        }

        await createProjectUpdate(client, updateInput)
        return
      }

      // Non-interactive mode: resolve content from various sources
      let finalBody: string | undefined

      if (body) {
        // Content provided inline via --body
        finalBody = body
      } else if (bodyFile) {
        // Content from file via --body-file
        try {
          finalBody = await readFile(bodyFile, "utf8")
        } catch (error) {
          if (isNotFoundError(error)) {
            throw new NotFoundError("File", bodyFile)
          } else {
            throw new CliError(
              `Failed to read body file: ${error instanceof Error ? error.message : String(error)}`,
            )
          }
        }
      } else if (!isStdinTTY()) {
        // Try reading from stdin if piped
        const stdinContent = await readContentFromStdin()
        if (stdinContent) {
          finalBody = stdinContent
        }
      } else if (isStdoutTTY()) {
        // No content provided, open editor
        console.log("Opening editor for update content...")
        finalBody = await openEditor()
        if (!finalBody) {
          console.log("No content entered.")
        }
      }

      // Validate health value if provided
      let validatedHealth: ProjectUpdateHealth | undefined
      if (health) {
        const validHealthValues = ["onTrack", "atRisk", "offTrack"]
        if (!validHealthValues.includes(health)) {
          throw new ValidationError(`Invalid health value: ${health}`, {
            suggestion: `Must be one of: ${validHealthValues.join(", ")}`,
          })
        }
        validatedHealth = health as ProjectUpdateHealth
      }

      // Build input
      const updateInput: {
        projectId: string
        body?: string
        health?: ProjectUpdateHealth
      } = {
        projectId: resolvedProjectId,
      }

      if (finalBody) {
        updateInput.body = finalBody
      }

      if (validatedHealth) {
        updateInput.health = validatedHealth
      }

      const spinner = createSpinner("", shouldShowSpinner())
      spinner.start()

      try {
        await createProjectUpdate(client, updateInput)
      } finally {
        spinner.stop()
      }
    } catch (error) {
      handleError(error, "Failed to create project update")
    }
  })

async function promptInteractiveCreate(): Promise<{
  body?: string
  health?: ProjectUpdateHealth
}> {
  // Prompt for health status
  const health = await select({
    message: "Project health status",
    choices: [
      { name: "On Track", value: "onTrack" },
      { name: "At Risk", value: "atRisk" },
      { name: "Off Track", value: "offTrack" },
      { name: "No change", value: "" },
    ],
    default: "",
  })

  // Prompt for body entry method
  const editorName = await getEditor()
  const editorDisplayName = editorName ? editorName.split("/").pop() : null

  const bodyMethod = await select({
    message: "How would you like to enter the update content?",
    choices: [
      { name: "Skip (no content)", value: "skip" },
      { name: "Enter inline", value: "inline" },
      ...(editorDisplayName ? [{ name: `Open ${editorDisplayName}`, value: "editor" }] : []),
      { name: "Read from file", value: "file" },
    ],
    default: "skip",
  })

  let body: string | undefined

  if (bodyMethod === "inline") {
    const inlineContent = await input({
      message: "Update content (markdown)",
      default: "",
    })
    body = inlineContent.trim() || undefined
  } else if (bodyMethod === "editor" && editorDisplayName) {
    console.log(`Opening ${editorDisplayName}...`)
    body = await openEditor()
    if (body) {
      console.log(`Content entered (${body.length} characters)`)
    }
  } else if (bodyMethod === "file") {
    const filePath = await input({
      message: "File path",
    })
    try {
      body = await readFile(filePath, "utf8")
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundError("File", filePath)
      } else {
        throw new CliError(
          `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  return {
    body,
    health: health ? (health as ProjectUpdateHealth) : undefined,
  }
}

async function createProjectUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  updateInput: {
    projectId: string
    body?: string
    health?: ProjectUpdateHealth
  },
): Promise<void> {
  try {
    const result = await client.request(CreateProjectUpdate, { input: updateInput })

    if (!result.projectUpdateCreate.success) {
      throw new CliError("Failed to create project update")
    }

    const projectUpdate = result.projectUpdateCreate.projectUpdate
    if (!projectUpdate) {
      throw new CliError("Project update creation failed - no update returned")
    }

    const projectName = projectUpdate.project?.name || "Unknown project"
    console.log(`Created status update for: ${projectName}`)
    if (projectUpdate.health) {
      console.log(`Health: ${projectUpdate.health}`)
    }
    console.log(projectUpdate.url)
  } catch (error) {
    handleError(error, "Failed to create project update")
  }
}
