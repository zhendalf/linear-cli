import { Command } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, handleError, ValidationError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { input, select } from "../../utils/prompt.ts"
import { isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

export const createCommand = new Command("create")
  .description("Create a linear team")
  .option("-n, --name <name>", "Name of the team")
  .option("-d, --description <description>", "Description of the team")
  .option("-k, --key <key>", "Team key (if not provided, will be generated from name)")
  .option("--private", "Make the team private")
  .option("--no-interactive", "Disable interactive prompts")
  .action(async (options) => {
    let { name, description, key, private: isPrivate, interactive } = options

    interactive = interactive && isStdoutTTY()

    // If no flags are provided, use interactive mode
    const noFlagsProvided = !name && !description && !key && isPrivate === undefined

    const spinner = createSpinner("", shouldShowSpinner() && interactive)

    try {
      if (noFlagsProvided && interactive) {
        console.log("Creating a new team...\n")

        // Prompt for name
        name = await input({
          message: "Team name:",
          minLength: 1,
        })

        // Prompt for description
        const descResult = await input({
          message: "Team description (optional):",
        })
        description = descResult || undefined

        // Prompt for key
        const keyResult = await input({
          message: "Team key (optional, will be generated from name if not provided):",
        })
        key = keyResult || undefined

        // Prompt for privacy
        const privacyChoice = await select({
          message: "Team visibility:",
          choices: [
            { name: "Public", value: "public" },
            { name: "Private", value: "private" },
          ],
          default: "public",
        })
        isPrivate = privacyChoice === "private" ? true : undefined

        console.log(`\nCreating team "${name}"...`)

        const createTeamMutation = gql(`
            mutation CreateTeam($input: TeamCreateInput!) {
              teamCreate(input: $input) {
                success
                team { id, name, key }
              }
            }
          `)

        const client = getGraphQLClient()
        const data = await client.request(createTeamMutation, {
          input: {
            name: name,
            description: description || undefined,
            key: key || undefined,
            private: isPrivate || undefined,
          },
        })

        if (!data.teamCreate.success) {
          throw new CliError("Team creation failed")
        }

        const team = data.teamCreate.team
        if (!team) {
          throw new CliError("Team creation failed - no team returned")
        }

        console.log(`✓ Created team ${team.key}: ${team.name}`)
        return
      }

      // Fallback to flag-based mode
      if (!name) {
        throw new ValidationError("Team name is required when not using interactive mode", {
          suggestion: "Use --name or run without any flags for interactive mode.",
        })
      }

      console.log(`Creating team "${name}"`)
      spinner.start()

      const createTeamMutation = gql(`
          mutation CreateTeam($input: TeamCreateInput!) {
            teamCreate(input: $input) {
              success
              team { id, name, key }
            }
          }
        `)

      const client = getGraphQLClient()
      const data = await client.request(createTeamMutation, {
        input: {
          name,
          description: description || undefined,
          key: key || undefined,
          private: isPrivate || undefined,
        },
      })

      if (!data.teamCreate.success) {
        throw new CliError("Team creation failed")
      }

      const team = data.teamCreate.team
      if (!team) {
        throw new CliError("Team creation failed - no team returned")
      }

      spinner.stop()
      console.log(`✓ Created team ${team.key}: ${team.name}`)
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to create team")
    }
  })
