import { readFile } from "node:fs/promises"
import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, ValidationError, handleError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { input } from "../../utils/prompt.ts"

export const commentUpdateCommand = new Command("update")
  .description("Update an existing comment")
  .argument("<commentId>")
  .option("-b, --body <text>", "New comment body text")
  .option("--body-file <path>", "Read comment body from a file (preferred for markdown content)")
  .action(async (commentId: string, options) => {
    const { body, bodyFile } = options

    try {
      // Validate that body and bodyFile are not both provided
      if (body && bodyFile) {
        throw new ValidationError("Cannot specify both --body and --body-file")
      }

      // Read body from file if provided
      let newBody = body
      if (bodyFile) {
        try {
          newBody = await readFile(bodyFile, "utf8")
        } catch (error) {
          throw new ValidationError(`Failed to read body file: ${bodyFile}`, {
            suggestion: `Error: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }

      let existingBody = ""

      // If no body provided, fetch existing comment to show as default
      if (!newBody) {
        const getCommentQuery = gql(`
          query GetComment($id: String!) {
            comment(id: $id) {
              body
            }
          }
        `)

        const client = getGraphQLClient()
        const commentData = await client.request(getCommentQuery, {
          id: commentId,
        })

        existingBody = commentData.comment?.body || ""

        newBody = await input({
          message: "New comment body",
          default: existingBody,
        })

        if (!newBody.trim()) {
          throw new ValidationError("Comment body cannot be empty")
        }
      }

      const mutation = gql(`
        mutation UpdateComment($id: String!, $input: CommentUpdateInput!) {
          commentUpdate(id: $id, input: $input) {
            success
            comment {
              id
              body
              updatedAt
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
      const data = await client.request(mutation, {
        id: commentId,
        input: {
          body: newBody,
        },
      })

      if (!data.commentUpdate.success) {
        throw new CliError("Failed to update comment")
      }

      const comment = data.commentUpdate.comment
      if (!comment) {
        throw new CliError("Comment update failed - no comment returned")
      }

      console.log("✓ Comment updated")
      console.log(comment.url)
    } catch (error) {
      handleError(error, "Failed to update comment")
    }
  })
