import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, handleError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getIssueIdentifier } from "../../utils/linear.ts"
import { createSpinner } from "../../utils/spinner.ts"

const unarchiveIssueMutation = gql(`
  mutation UnarchiveIssue($id: String!) {
    issueUnarchive(id: $id) {
      success
      entity {
        identifier
        title
      }
    }
  }
`)

export const unarchiveCommand = new Command("unarchive")
  .description("Unarchive an issue")
  .argument("[issueId]")
  .action(async (issueIdArg: string | undefined) => {
    try {
      const issueId = await getIssueIdentifier(issueIdArg)
      if (!issueId) {
        throw new ValidationError("Could not determine issue ID", {
          suggestion:
            "Please provide an issue ID like 'ENG-123' or run from a branch with an issue ID.",
        })
      }

      const spinner = createSpinner("", shouldShowSpinner())
      spinner.start()

      const client = getGraphQLClient()
      const data = await client.request(unarchiveIssueMutation, { id: issueId })

      spinner.stop()

      if (!data.issueUnarchive.success) {
        throw new CliError("Issue unarchive failed")
      }

      const entity = data.issueUnarchive.entity
      const identifier = entity?.identifier ?? issueId
      const title = entity?.title ? `: ${entity.title}` : ""
      console.log(`✓ Unarchived issue ${identifier}${title}`)
    } catch (error) {
      handleError(error, "Failed to unarchive issue")
    }
  })
