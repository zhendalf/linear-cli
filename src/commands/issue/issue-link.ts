import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { getIssueId, getIssueIdentifier } from "../../utils/linear.ts"
import {
  CliError,
  handleError,
  isClientError,
  isNotFoundError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors.ts"

function looksLikeUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://")
}

export const linkCommand = new Command("link")
  .description("Link a URL to an issue")
  .argument("<urlOrIssueId>")
  .argument("[url]")
  .option("-t, --title <title>", "Custom title for the link")
  .addHelpText("after", `
Examples:
  $ linear issue link https://github.com/org/repo/pull/123
  $ linear issue link ENG-123 https://github.com/org/repo/pull/123
  $ linear issue link ENG-123 https://example.com --title "Design doc"`)
  .action(async (urlOrIssueId: string, url: string | undefined, options) => {
    const { title } = options

    try {
      let issueIdInput: string | undefined
      let linkUrl: string

      if (url != null) {
        // Two args: first is issue ID, second is URL
        issueIdInput = urlOrIssueId
        linkUrl = url
      } else if (looksLikeUrl(urlOrIssueId)) {
        // One arg that looks like a URL: auto-detect issue from branch
        issueIdInput = undefined
        linkUrl = urlOrIssueId
      } else {
        throw new ValidationError(
          `Expected a URL but got '${urlOrIssueId}'`,
          { suggestion: "Provide a URL starting with http:// or https://." },
        )
      }

      if (!looksLikeUrl(linkUrl)) {
        throw new ValidationError(
          `Invalid URL: '${linkUrl}'`,
          { suggestion: "Provide a URL starting with http:// or https://." },
        )
      }

      const resolvedIdentifier = await getIssueIdentifier(issueIdInput)
      if (!resolvedIdentifier) {
        throw new ValidationError(
          "Could not determine issue ID",
          {
            suggestion:
              "Please provide an issue ID like 'ENG-123', or run from a branch that contains an issue identifier.",
          },
        )
      }

      // attachmentLinkURL needs a UUID
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

      const mutation = gql(`
        mutation AttachmentLinkURL($issueId: String!, $url: String!, $title: String) {
          attachmentLinkURL(issueId: $issueId, url: $url, title: $title) {
            success
            attachment {
              id
              title
              url
            }
          }
        }
      `)

      const client = getGraphQLClient()
      const data = await client.request(mutation, {
        issueId: issueUuid,
        url: linkUrl,
        title,
      })

      if (!data.attachmentLinkURL.success) {
        throw new CliError("Failed to link URL to issue")
      }

      const attachment = data.attachmentLinkURL.attachment
      console.log(`✓ Linked to ${resolvedIdentifier}: ${attachment.title}`)
    } catch (error) {
      handleError(error, "Failed to link URL")
    }
  })
