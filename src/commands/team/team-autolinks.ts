import { Command } from "commander"
import { getOption } from "../../config.ts"
import { LINEAR_WEB_BASE_URL } from "../../const.ts"
import { CliError, ValidationError, handleError } from "../../utils/errors.ts"
import { getTeamKey } from "../../utils/linear.ts"
import { runCommand } from "../../utils/runtime.ts"

export const autolinksCommand = new Command("autolinks")
  .description("Configure GitHub repository autolinks for Linear issues with this team prefix")
  .action(async () => {
    try {
      const teamId = getTeamKey()
      if (!teamId) {
        throw new ValidationError("Could not determine team id from directory name", {
          suggestion: "Run `linear configure` to set a team.",
        })
      }

      const workspace = getOption("workspace")
      if (!workspace) {
        throw new ValidationError(
          "workspace is not set via command line, configuration file, or environment",
        )
      }

      const result = await runCommand("gh", [
        "api",
        "repos/{owner}/{repo}/autolinks",
        "-f",
        `key_prefix=${teamId}-`,
        "-f",
        `url_template=${LINEAR_WEB_BASE_URL}/${workspace}/issue/${teamId}-<num>`,
      ])

      if (result.stdout) process.stdout.write(result.stdout)
      if (result.stderr) process.stderr.write(result.stderr)

      if (!result.success) {
        throw new CliError("Failed to configure autolinks")
      }
    } catch (error) {
      handleError(error, "Failed to configure autolinks")
    }
  })
