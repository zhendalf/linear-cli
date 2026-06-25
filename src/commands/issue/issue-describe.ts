import { Command, Option } from "commander"
import { ValidationError, handleError } from "../../utils/errors.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { formatIssueDescription } from "../../utils/jj.ts"
import { fetchIssueDetails, getIssueIdentifier } from "../../utils/linear.ts"

export const describeCommand = new Command("describe")
  .description("Print the issue title and Linear-issue trailer")
  .argument("[issueId]")
  .option("-r, --references", "Use 'References' instead of 'Fixes' for the Linear issue link")
  // commander allows only one long flag per option; keep --ref as a hidden alias
  .addOption(new Option("--ref", "Alias for --references").hideHelp())
  .action(async (issueId: string | undefined, options) => {
    try {
      const resolvedId = await getIssueIdentifier(issueId)
      if (!resolvedId) {
        throw new ValidationError("Could not determine issue ID", {
          suggestion: "Please provide an issue ID like 'ENG-123'.",
        })
      }

      const { title, url } = await fetchIssueDetails(resolvedId, shouldShowSpinner())

      const magicWord = options.references || options.ref ? "References" : "Fixes"
      console.log(formatIssueDescription(resolvedId, title, url, magicWord))
    } catch (error) {
      handleError(error, "Failed to get issue description")
    }
  })
