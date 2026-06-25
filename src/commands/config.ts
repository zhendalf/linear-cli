import { Command } from "commander"
import { join } from "node:path"
import { writeFile, stat } from "node:fs/promises"
import { gql } from "../__codegen__/gql.ts"
import { getGraphQLClient } from "../utils/graphql.ts"
import { getDefaultWorkspace, getWorkspaces } from "../credentials.ts"
import { getCliWorkspace, getOption, setCliWorkspace } from "../config.ts"
import { AuthError, handleError, NotFoundError } from "../utils/errors.ts"
import { select, searchSelect } from "../utils/prompt.ts"
import { runCommand } from "../utils/runtime.ts"

const configQuery = gql(`
  query Config {
    viewer {
      organization {
        urlKey
      }
    }
    teams {
      nodes {
        id
        key
        name
      }
    }
  }
`)

export const configCommand = new Command("config")
  .description("Interactively generate .linear.toml configuration")
  .action(async () => {
    try {
      console.log(`
██      ██ ███    ██ ███████  █████  ██████      ██████ ██      ██
██      ██ ████   ██ ██      ██   ██ ██   ██    ██      ██      ██
██      ██ ██ ██  ██ █████   ███████ ██████     ██      ██      ██
██      ██ ██  ██ ██ ██      ██   ██ ██   ██    ██      ██      ██
███████ ██ ██   ████ ███████ ██   ██ ██   ██     ██████ ███████ ██
`)

      // Check for explicit API key sources (env var, config, or --workspace flag)
      const hasExplicitApiKey = process.env["LINEAR_API_KEY"] ||
        getOption("api_key") ||
        getCliWorkspace()

      if (!hasExplicitApiKey) {
        const workspaces = getWorkspaces()
        if (workspaces.length === 0) {
          throw new AuthError("No authentication configured", {
            suggestion: "Run `linear auth login` to add a workspace.",
          })
        }

        if (workspaces.length === 1) {
          // Single workspace - use automatically
          setCliWorkspace(workspaces[0])
        } else {
          // Multiple workspaces - prompt to select
          const defaultWorkspace = getDefaultWorkspace()
          const selected = await select({
            message: "Select workspace:",
            choices: workspaces.map((ws) => ({
              name: ws + (ws === defaultWorkspace ? " (default)" : ""),
              value: ws,
            })),
            default: defaultWorkspace,
          })
          setCliWorkspace(selected)
        }
      }

      const client = getGraphQLClient()
      const result = await client.request(configQuery)
      const workspace = result.viewer.organization.urlKey
      const teams = result.teams.nodes
      // Sort teams alphabetically by name (case insensitive)
      teams.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      )

      // searchSelect replaces Select.prompt({ search: true })
      const selectedTeamId = await searchSelect({
        message: "Select a team:",
        choices: teams.map((team) => ({
          name: `${team.name} (${team.key})`,
          value: team.id,
        })),
      })

      const team = teams.find((t) => t.id === selectedTeamId)

      if (!team) {
        throw new NotFoundError("Team", selectedTeamId)
      }

      // Replace cliffy grouped prompt([...]) with individual await select(...)
      const sortChoice = await select({
        message: "Select sort order:",
        choices: [
          { name: "manual", value: "manual" },
          { name: "priority", value: "priority" },
        ],
      })
      const teamKey = team.key

      // Determine file path for .linear.toml: prefer git root .config dir, then git root, then cwd.
      let filePath: string
      try {
        const gitRootResult = await runCommand("git", [
          "rev-parse",
          "--show-toplevel",
        ])
        if (!gitRootResult.success) {
          throw new Error("git rev-parse failed")
        }
        const gitRoot = gitRootResult.stdout.trim()
        const configDir = join(gitRoot, ".config")
        try {
          await stat(configDir)
          filePath = join(configDir, "linear.toml")
        } catch {
          filePath = join(gitRoot, ".linear.toml")
        }
      } catch {
        filePath = "./.linear.toml"
      }

      const tomlContent = `# linear cli
# https://github.com/schpet/linear-cli

workspace = "${workspace}"
team_id = "${teamKey}"
issue_sort = "${sortChoice}"
`

      await writeFile(filePath, tomlContent, "utf8")
      console.log("Configuration written to", filePath)
    } catch (error) {
      handleError(error, "Failed to generate configuration")
    }
  })
