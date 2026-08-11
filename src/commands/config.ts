import { stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { Command, Option } from "commander"
import { gql } from "../__codegen__/gql.ts"
import { getCliWorkspace, getOption, setCliWorkspace } from "../config.ts"
import { getDefaultWorkspace, getWorkspaces } from "../credentials.ts"
import { AuthError, handleError, NotFoundError, ValidationError } from "../utils/errors.ts"
import { getGraphQLClient } from "../utils/graphql.ts"
import { searchSelect, select } from "../utils/prompt.ts"
import { isStdinTTY, runCommand } from "../utils/runtime.ts"

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

const SORT_VALUES = ["manual", "priority"] as const

/**
 * Determine the file path for .linear.toml: prefer git root .config dir,
 * then git root, then cwd.
 */
async function resolveConfigPath(): Promise<string> {
  try {
    const gitRootResult = await runCommand("git", ["rev-parse", "--show-toplevel"])
    if (!gitRootResult.success) {
      throw new Error("git rev-parse failed")
    }
    const gitRoot = gitRootResult.stdout.trim()
    const configDir = join(gitRoot, ".config")
    try {
      await stat(configDir)
      return join(configDir, "linear.toml")
    } catch {
      return join(gitRoot, ".linear.toml")
    }
  } catch {
    return "./.linear.toml"
  }
}

async function writeConfigFile(workspace: string, teamKey: string, sort: string): Promise<string> {
  const filePath = await resolveConfigPath()
  const tomlContent = `# linear cli
# https://github.com/zhendalf/linear-cli

workspace = "${workspace}"
team_id = "${teamKey}"
issue_sort = "${sort}"
`
  await writeFile(filePath, tomlContent, "utf8")
  return filePath
}

export const configCommand = new Command("config")
  .description("Generate .linear.toml configuration (interactive or via flags)")
  .option("--team <team>", "Team key to write (non-interactive, e.g. ENG)")
  .addOption(
    new Option("--sort <sort>", "Issue sort order (non-interactive)").choices([...SORT_VALUES]),
  )
  .option("--workspace <workspace>", "Workspace slug to write (defaults to the resolved workspace)")
  .option("-y, --yes", "Write without prompting (also implied by --team/--sort or non-TTY stdin)")
  .option("--write", "Alias for --yes; write without prompting")
  .action(async (options) => {
    const { team: teamFlag, sort: sortFlag, workspace: workspaceFlag, yes, write } = options
    try {
      // Determine whether we run non-interactively. Any explicit flag, an
      // explicit confirm flag, or a non-TTY stdin forces the non-interactive path.
      const nonInteractive =
        teamFlag != null || sortFlag != null || yes === true || write === true || !isStdinTTY()

      if (!nonInteractive) {
        console.log(`
██      ██ ███    ██ ███████  █████  ██████      ██████ ██      ██
██      ██ ████   ██ ██      ██   ██ ██   ██    ██      ██      ██
██      ██ ██ ██  ██ █████   ███████ ██████     ██      ██      ██
██      ██ ██  ██ ██ ██      ██   ██ ██   ██    ██      ██      ██
███████ ██ ██   ████ ███████ ██   ██ ██   ██     ██████ ███████ ██
`)
      }

      // Check for explicit API key sources (env var, config, or --workspace flag)
      const hasExplicitApiKey =
        process.env["LINEAR_API_KEY"] || getOption("api_key") || getCliWorkspace()

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
        } else if (nonInteractive) {
          // Multiple workspaces but no TTY/flags to prompt - use the default.
          const defaultWorkspace = getDefaultWorkspace()
          if (!defaultWorkspace) {
            throw new ValidationError(
              "Multiple workspaces configured but none selected non-interactively",
              {
                suggestion:
                  "Pass --workspace <slug> or set a default workspace with `linear auth`.",
              },
            )
          }
          setCliWorkspace(defaultWorkspace)
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
      const resolvedWorkspace = result.viewer.organization.urlKey
      const teams = result.teams.nodes
      // Sort teams alphabetically by name (case insensitive)
      teams.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))

      let teamKey: string
      let sortChoice: string
      const workspace = workspaceFlag ?? resolvedWorkspace

      if (nonInteractive) {
        // Resolve team key from the flag (case-insensitive), validating it exists.
        if (teamFlag == null) {
          throw new ValidationError("--team is required in non-interactive mode", {
            suggestion: "Pass --team <KEY> (e.g. --team ENG).",
          })
        }
        const matchedTeam = teams.find((t) => t.key.toLowerCase() === teamFlag.toLowerCase())
        if (!matchedTeam) {
          throw new NotFoundError("Team", teamFlag)
        }
        teamKey = matchedTeam.key
        sortChoice = sortFlag ?? "priority"
      } else {
        // Filterable team picker for long team lists.
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
        teamKey = team.key

        // Prompt for the sort order.
        sortChoice = await select({
          message: "Select sort order:",
          choices: [
            { name: "manual", value: "manual" },
            { name: "priority", value: "priority" },
          ],
        })
      }

      const filePath = await writeConfigFile(workspace, teamKey, sortChoice)
      console.log("Configuration written to", filePath)
    } catch (error) {
      handleError(error, "Failed to generate configuration")
    }
  })
