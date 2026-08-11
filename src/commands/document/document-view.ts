import { Command } from "commander"
import open from "open"
import { gql } from "../../__codegen__/gql.ts"
import { getOption } from "../../config.ts"
import { renderMarkdown } from "../../utils/charmd/mod.ts"
import { formatRelativeTime } from "../../utils/display.ts"
import { handleError, isClientError, isNotFoundError, NotFoundError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { downloadMarkdownImages, replaceImageUrls } from "../../utils/markdown-images.ts"
import { pipeToUserPager, shouldUsePager } from "../../utils/pager.ts"
import { getConsoleSize, isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const GetDocument = gql(`
  query GetDocument($id: String!) {
    document(id: $id) {
      id
      title
      slugId
      content
      url
      createdAt
      updatedAt
      creator {
        name
        email
      }
      project {
        name
        slugId
      }
      issue {
        identifier
        title
      }
    }
  }
`)

export const viewCommand = new Command("view")
  .alias("v")
  .description("View a document's content")
  .argument("<id>", "Document ID or slug")
  .option("--raw", "Output raw markdown without rendering")
  .option("-w, --web", "Open document in browser")
  .option("--json", "Output full document as JSON")
  .option("--no-download", "Keep remote URLs instead of downloading files")
  .option("--no-pager", "Disable automatic paging for long output")
  .action(async (id: string, options) => {
    const { raw, web, json, download, pager } = options
    const usePager = pager !== false
    const spinner = createSpinner("", shouldShowSpinner() && !raw && !json)
    spinner.start()

    try {
      const client = getGraphQLClient()
      const result = await client.request(GetDocument, { id })
      spinner.stop()

      const document = result.document
      if (!document) {
        throw new NotFoundError("Document", id)
      }

      // Open in browser if requested
      if (web) {
        console.log(`Opening ${document.url} in web browser`)
        await open(document.url)
        return
      }

      // JSON output preserves the raw GraphQL response; skip image rewrites.
      if (json) {
        console.log(JSON.stringify(document, null, 2))
        return
      }

      let content = document.content
      const shouldDownload = download && getOption("download_images") !== false
      if (shouldDownload && content) {
        const urlToPath = await downloadMarkdownImages([content])
        if (urlToPath.size > 0) {
          content = await replaceImageUrls(content, urlToPath)
        }
      }

      // Raw output (for piping)
      if (raw || !isStdoutTTY()) {
        if (content) {
          console.log(content)
        }
        return
      }

      // Rendered output
      const lines: string[] = []

      // Title
      lines.push(`# ${document.title}`)
      lines.push("")

      // Metadata
      lines.push(`**Slug:** ${document.slugId}`)
      lines.push(`**URL:** ${document.url}`)

      if (document.creator) {
        lines.push(`**Creator:** ${document.creator.name}`)
      }

      if (document.project) {
        lines.push(`**Project:** ${document.project.name}`)
      }

      if (document.issue) {
        lines.push(`**Issue:** ${document.issue.identifier} - ${document.issue.title}`)
      }

      lines.push(`**Created:** ${formatRelativeTime(document.createdAt)}`)
      lines.push(`**Updated:** ${formatRelativeTime(document.updatedAt)}`)

      if (content) {
        lines.push("")
        lines.push("---")
        lines.push("")
        lines.push(content)
      }

      const markdown = lines.join("\n")
      const terminalWidth = getConsoleSize().columns
      const finalOutput = renderMarkdown(markdown, { lineWidth: terminalWidth })
      if (shouldUsePager(finalOutput.split("\n"), usePager)) {
        await pipeToUserPager(finalOutput)
      } else {
        console.log(finalOutput)
      }
    } catch (error) {
      spinner.stop()
      if (isClientError(error) && isNotFoundError(error)) {
        throw new NotFoundError("Document", id)
      }
      handleError(error, "Failed to view document")
    }
  })
