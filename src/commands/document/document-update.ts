import { Command } from "commander"
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawn } from "node:child_process"
import { gql } from "../../__codegen__/gql.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { getEditor } from "../../utils/editor.ts"
import { readIdsFromStdin } from "../../utils/bulk.ts"
import { isStdinTTY } from "../../utils/runtime.ts"
import {
  CliError,
  handleError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors.ts"

/**
 * Open editor with initial content and return the edited content
 */
async function openEditorWithContent(
  initialContent: string,
): Promise<string | undefined> {
  const editor = await getEditor()
  if (!editor) {
    throw new ValidationError("No editor found", {
      suggestion:
        "Set EDITOR environment variable or configure git editor with: git config --global core.editor <editor>",
    })
  }

  // Create a temporary file with initial content
  const dir = await mkdtemp(join(tmpdir(), "linear-cli-"))
  const tempFile = join(dir, "edit.md")

  try {
    // Write initial content to temp file
    await writeFile(tempFile, initialContent, "utf8")

    // Open the editor
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(editor, [tempFile], {
        stdio: "inherit",
        shell: false,
      })
      child.on("error", reject)
      child.on("close", (code) => resolve(code ?? 1))
    })

    if (exitCode !== 0) {
      throw new CliError("Editor exited with an error")
    }

    // Read the content back
    const content = await readFile(tempFile, "utf8")
    const cleaned = content.trim()

    return cleaned.length > 0 ? cleaned : undefined
  } catch (error) {
    if (error instanceof CliError || error instanceof ValidationError) {
      throw error
    }
    throw new CliError(
      `Failed to open editor: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    )
  } finally {
    // Clean up the temporary file
    try {
      await rm(tempFile, { force: true })
      await rm(dir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Read content from stdin if available (with timeout to avoid hanging)
 */
async function readContentFromStdin(): Promise<string | undefined> {
  // Check if stdin has data (not a TTY)
  if (isStdinTTY()) {
    return undefined
  }

  try {
    // Use timeout to avoid hanging when stdin is not a terminal but has no data
    // (e.g., in test subprocess environments)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("stdin timeout")), 100)
    })

    const ids = await Promise.race([readIdsFromStdin(), timeoutPromise])
    // Join back with newlines since it's content, not IDs
    const content = ids.join("\n")
    return content.length > 0 ? content : undefined
  } catch {
    return undefined
  }
}

export const updateCommand = new Command("update")
  .alias("u")
  .description("Update an existing document")
  .argument("<documentId>", "Document ID or slug")
  .option("-t, --title <title>", "New title for the document")
  .option("-c, --content <content>", "New markdown content (inline)")
  .option(
    "-f, --content-file <path>",
    "Read new content from file",
  )
  .option("--icon <icon>", "New icon (emoji)")
  .option("-e, --edit", "Open current content in $EDITOR for editing")
  .action(
    async (
      documentId: string,
      options,
    ) => {
      const { title, content, contentFile, icon, edit } = options
      try {
        const client = getGraphQLClient()

        // Build the update input
        const inputData: Record<string, string> = {}

        // Add title if provided
        if (title) {
          inputData.title = title
        }

        // Add icon if provided
        if (icon) {
          inputData.icon = icon
        }

        // Resolve content from various sources
        let finalContent: string | undefined

        if (content) {
          // Content provided inline
          finalContent = content
        } else if (contentFile) {
          // Content from file
          try {
            finalContent = await readFile(contentFile, "utf8")
          } catch (error) {
            const nodeErr = error as NodeJS.ErrnoException
            if (nodeErr?.code === "ENOENT") {
              throw new NotFoundError("File", contentFile)
            }
            throw new CliError(
              `Failed to read content file: ${
                error instanceof Error ? error.message : String(error)
              }`,
              { cause: error },
            )
          }
        } else if (edit) {
          // Edit mode: fetch current content and open in editor
          const getDocumentQuery = gql(`
          query GetDocumentForEdit($id: String!) {
            document(id: $id) {
              id
              title
              content
            }
          }
        `)

          const documentData = await client.request(getDocumentQuery, {
            id: documentId,
          })

          if (!documentData?.document) {
            throw new NotFoundError("Document", documentId)
          }

          const currentContent = documentData.document.content || ""
          console.log(`Opening ${documentData.document.title} in editor...`)

          finalContent = await openEditorWithContent(currentContent)

          if (finalContent === undefined) {
            console.log("No changes made, update cancelled.")
            return
          }

          // Check if content actually changed
          if (finalContent === currentContent) {
            console.log("No changes detected, update cancelled.")
            return
          }
        } else if (
          !isStdinTTY() && Object.keys(inputData).length === 0
        ) {
          // Only try reading from stdin if no other update fields were provided
          // This avoids hanging when stdin is piped but has no data (e.g., in test environments)
          const stdinContent = await readContentFromStdin()
          if (stdinContent) {
            finalContent = stdinContent
          }
        }

        // Add content to input if resolved
        if (finalContent !== undefined) {
          inputData.content = finalContent
        }

        // Validate that at least one field is being updated
        if (Object.keys(inputData).length === 0) {
          throw new ValidationError("No update fields provided", {
            suggestion:
              "Use --title, --content, --content-file, --icon, or --edit.",
          })
        }

        // Execute the update
        const updateMutation = gql(`
        mutation UpdateDocument($id: String!, $input: DocumentUpdateInput!) {
          documentUpdate(id: $id, input: $input) {
            success
            document {
              id
              slugId
              title
              url
              updatedAt
            }
          }
        }
      `)

        const result = await client.request(updateMutation, {
          id: documentId,
          input: inputData,
        })

        if (!result.documentUpdate.success) {
          throw new CliError("Document update failed")
        }

        const document = result.documentUpdate.document
        if (!document) {
          throw new CliError("Document update failed - no document returned")
        }

        console.log(`✓ Updated document: ${document.title}`)
        console.log(document.url)
      } catch (error) {
        handleError(error, "Failed to update document")
      }
    },
  )
