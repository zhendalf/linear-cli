import { Command } from "commander"
import { fetchIssueDetails, getIssueIdentifier } from "../../utils/linear.ts"
import { handleError, ValidationError } from "../../utils/errors.ts"

export const titleCommand = new Command("title")
  .description("Print the issue title")
  .argument("[issueId]")
  .action(async (issueId: string | undefined) => {
    try {
      const resolvedId = await getIssueIdentifier(issueId)
      if (!resolvedId) {
        throw new ValidationError(
          "Could not determine issue ID",
          { suggestion: "Please provide an issue ID like 'ENG-123'." },
        )
      }
      const { title } = await fetchIssueDetails(resolvedId, false)
      console.log(title)
    } catch (error) {
      handleError(error, "Failed to get issue title")
    }
  })
