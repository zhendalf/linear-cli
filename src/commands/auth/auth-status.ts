import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { LINEAR_WEB_BASE_URL } from "../../const.ts"
import { getCredentialsPath } from "../../credentials.ts"
import { handleError } from "../../utils/errors.ts"
import { getGraphQLClient, getResolvedApiKey } from "../../utils/graphql.ts"

const viewerQuery = gql(`
  query AuthStatus {
    viewer {
      id
      name
      displayName
      email
      admin
      guest
      organization {
        name
        urlKey
        logoUrl
      }
    }
  }
`)

export const statusCommand = new Command("status")
  .description("Print information about the authenticated user")
  .action(async () => {
    try {
      const credPath = getCredentialsPath()
      const hasKey = !!getResolvedApiKey()

      console.log(`Credentials file: ${credPath ?? "(not found)"}`)
      console.log(`API key configured: ${hasKey ? "yes" : "no"}`)

      if (!hasKey) {
        console.log()
        console.log("Not authenticated. Run `linear auth login` to add a workspace.")
        return
      }

      const client = getGraphQLClient()
      const result = await client.request(viewerQuery)
      const viewer = result.viewer
      const org = viewer.organization

      console.log()
      console.log(`Workspace: ${org.name}`)
      console.log(`  Slug: ${org.urlKey}`)
      console.log(`  URL: ${LINEAR_WEB_BASE_URL}/${org.urlKey}`)

      console.log(`User: ${viewer.name}`)
      if (viewer.displayName !== viewer.name) {
        console.log(`  Display name: ${viewer.displayName}`)
      }
      console.log(`  Email: ${viewer.email}`)
      if (viewer.admin) {
        console.log(`  Role: admin`)
      } else if (viewer.guest) {
        console.log(`  Role: guest`)
      }
    } catch (error) {
      handleError(error, "Failed to get auth status")
    }
  })
