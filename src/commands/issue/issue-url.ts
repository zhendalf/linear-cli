import { Command } from "commander"
import { handleError, ValidationError } from "../../utils/errors.ts"
import { fetchIssueDetails, getIssueIdentifier } from "../../utils/linear.ts"

export const urlCommand = new Command("url")
  .description("Print the issue URL")
  .argument("[issueId]")
  .action(async (issueId: string | undefined) => {
    try {
      const resolvedId = await getIssueIdentifier(issueId)
      if (!resolvedId) {
        throw new ValidationError("Could not determine issue ID", {
          suggestion: "Please provide an issue ID like 'ENG-123'.",
        })
      }
      const { url } = await fetchIssueDetails(resolvedId, false)
      console.log(url)
    } catch (error) {
      handleError(error, "Failed to get issue URL")
    }
  })
