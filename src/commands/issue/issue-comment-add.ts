import { readFile } from "node:fs/promises"
import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, handleError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getIssueIdentifier } from "../../utils/linear.ts"
import { input } from "../../utils/prompt.ts"
import { formatAsMarkdownLink, uploadFile, validateFilePath } from "../../utils/upload.ts"

export const commentAddCommand = new Command("add")
  .description("Add a comment to an issue or reply to a comment")
  .argument("[issueId]")
  .option("-b, --body <text>", "Comment body text")
  .option("--body-file <path>", "Read comment body from a file (preferred for markdown content)")
  .option("-p, --parent <id>", "Parent comment ID for replies")
  .option(
    "-a, --attach <filepath>",
    "Attach a file to the comment (can be used multiple times)",
    (val: string, prev: string[] = []) => [...prev, val],
  )
  .action(async (issueId: string | undefined, options) => {
    const { body, bodyFile, parent, attach } = options

    try {
      // Validate that body and bodyFile are not both provided
      if (body && bodyFile) {
        throw new ValidationError("Cannot specify both --body and --body-file")
      }

      // Read body from file if provided
      let commentBody = body
      if (bodyFile) {
        try {
          commentBody = await readFile(bodyFile, "utf8")
        } catch (error) {
          throw new ValidationError(`Failed to read body file: ${bodyFile}`, {
            suggestion: `Error: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }

      const resolvedIdentifier = await getIssueIdentifier(issueId)
      if (!resolvedIdentifier) {
        throw new ValidationError("Could not determine issue ID", {
          suggestion: "Please provide an issue ID like 'ENG-123'.",
        })
      }

      // Validate and upload attachments first
      const attachments: string[] = attach || []
      const uploadedFiles: {
        filename: string
        assetUrl: string
        isImage: boolean
      }[] = []

      if (attachments.length > 0) {
        // Validate all files exist before uploading
        for (const filepath of attachments) {
          await validateFilePath(filepath)
        }

        // Upload files
        for (const filepath of attachments) {
          const result = await uploadFile(filepath, {
            showProgress: shouldShowSpinner(),
          })
          uploadedFiles.push({
            filename: result.filename,
            assetUrl: result.assetUrl,
            isImage: result.contentType.startsWith("image/"),
          })
          console.log(`✓ Uploaded ${result.filename}`)
        }
      }

      // If no body provided and no attachments, prompt for it
      if (!commentBody && uploadedFiles.length === 0) {
        commentBody = await input({
          message: "Comment body",
          default: "",
        })

        if (!commentBody.trim()) {
          throw new ValidationError("Comment body cannot be empty")
        }
      }

      // Append attachment links to comment body
      if (uploadedFiles.length > 0) {
        const attachmentLinks = uploadedFiles.map((file) => {
          return formatAsMarkdownLink({
            filename: file.filename,
            assetUrl: file.assetUrl,
            contentType: file.isImage ? "image/png" : "application/octet-stream",
            size: 0,
          })
        })

        if (commentBody) {
          commentBody = `${commentBody}\n\n${attachmentLinks.join("\n")}`
        } else {
          commentBody = attachmentLinks.join("\n")
        }
      }

      const mutation = gql(`
        mutation AddComment($input: CommentCreateInput!) {
          commentCreate(input: $input) {
            success
            comment {
              id
              body
              createdAt
              url
              user {
                name
                displayName
              }
            }
          }
        }
      `)

      const client = getGraphQLClient()
      const inputData: Record<string, unknown> = {
        body: commentBody,
        issueId: resolvedIdentifier,
      }

      if (parent) {
        inputData.parentId = parent
      }

      const data = await client.request(mutation, {
        input: inputData,
      })

      if (!data.commentCreate.success) {
        throw new CliError("Failed to create comment")
      }

      const comment = data.commentCreate.comment
      if (!comment) {
        throw new CliError("Comment creation failed - no comment returned")
      }

      console.log(`✓ Comment added to ${resolvedIdentifier}`)
      console.log(comment.url)
    } catch (error) {
      handleError(error, "Failed to add comment")
    }
  })
