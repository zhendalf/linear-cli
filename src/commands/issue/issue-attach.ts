import { basename } from "node:path"
import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import type { AttachmentCreateInput } from "../../__codegen__/graphql.ts"
import {
  CliError,
  handleError,
  isClientError,
  isNotFoundError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getIssueId, getIssueIdentifier } from "../../utils/linear.ts"
import { uploadFile, validateFilePath } from "../../utils/upload.ts"

/** Quote a value for safe copy-paste into a shell command. */
function quoteForShell(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=-]+$/.test(value)) return value
  return `'${value.replaceAll("'", "'\\''")}'`
}

export const attachCommand = new Command("attach")
  .description("Create a sidebar link attachment on an issue (images do not render inline)")
  .argument("<issueId>")
  .argument("<filepath>")
  .option("-t, --title <title>", "Custom title for the attachment")
  .option(
    "-c, --comment <body>",
    "Create a linked comment with this body; the file remains a sidebar attachment",
  )
  .option(
    "--public",
    "Upload images to a public, unauthenticated URL (default: private, workspace-members only)",
  )
  .action(async (issueId: string, filepath: string, options) => {
    const { title, comment, public: makePublic } = options

    try {
      const resolvedIdentifier = await getIssueIdentifier(issueId)
      if (!resolvedIdentifier) {
        throw new ValidationError("Could not determine issue ID", {
          suggestion: "Please provide an issue ID like 'ENG-123'.",
        })
      }

      // Validate file exists
      await validateFilePath(filepath)

      // Get the issue UUID (attachmentCreate needs UUID, not identifier)
      let issueUuid: string | undefined
      try {
        issueUuid = await getIssueId(resolvedIdentifier)
      } catch (error) {
        if (isClientError(error) && isNotFoundError(error)) {
          throw new NotFoundError("Issue", resolvedIdentifier)
        }
        throw error
      }
      if (!issueUuid) {
        throw new NotFoundError("Issue", resolvedIdentifier)
      }

      // Upload the file
      const uploadResult = await uploadFile(filepath, {
        showProgress: shouldShowSpinner(),
        makePublic,
      })
      console.log(`✓ Uploaded ${uploadResult.filename}`)
      if (uploadResult.public) {
        console.warn(`⚠ Uploaded to a public URL readable by anyone: ${uploadResult.assetUrl}`)
      }

      // Create the attachment
      const mutation = gql(`
        mutation AttachmentCreate($input: AttachmentCreateInput!) {
          attachmentCreate(input: $input) {
            success
            attachment {
              id
              url
              title
            }
          }
        }
      `)

      const client = getGraphQLClient()
      const attachmentTitle = title || basename(filepath)

      const input: AttachmentCreateInput = {
        issueId: issueUuid,
        title: attachmentTitle,
        url: uploadResult.assetUrl,
        commentBody: comment,
      }

      const data = await client.request(mutation, { input })

      if (!data.attachmentCreate.success) {
        throw new CliError("Failed to create attachment")
      }

      const attachment = data.attachmentCreate.attachment
      console.log(`✓ Sidebar link attachment created: ${attachment.title}`)
      console.log(attachment.url)
      if (uploadResult.contentType.startsWith("image/")) {
        const suggested = [
          "linear issue comment add",
          resolvedIdentifier,
          "--attach",
          quoteForShell(filepath),
          ...(makePublic ? ["--public"] : []),
        ].join(" ")
        console.log(
          `Hint: Sidebar link attachments do not render images inline. For inline display, run: ${suggested}`,
        )
      }
    } catch (error) {
      handleError(error, "Failed to attach file")
    }
  })
