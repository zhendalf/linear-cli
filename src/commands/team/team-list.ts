import { Command } from "commander"
import stringWidth from "string-width"
import { gql } from "../../__codegen__/gql.ts"
import type { GetTeamsQuery } from "../../__codegen__/graphql.ts"
import { getOption } from "../../config.ts"
import { LINEAR_WEB_BASE_URL } from "../../const.ts"
import { getTimeAgo, padDisplay } from "../../utils/display.ts"
import { ValidationError, handleError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { getConsoleSize, isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"
import { applyConsoleFormat } from "../../utils/styling.ts"

const GetTeams = gql(`
  query GetTeams($filter: TeamFilter, $first: Int, $after: String) {
    teams(filter: $filter, first: $first, after: $after) {
      nodes {
        id
        name
        key
        description
        icon
        color
        cyclesEnabled
        createdAt
        updatedAt
        archivedAt
        organization {
          id
          name
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`)

export const listCommand = new Command("list")
  .description("List teams")
  .option("-w, --web", "Open in web browser")
  .option("-a, --app", "Open in Linear.app")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const { web, app, json } = options
    const spinner = createSpinner("", shouldShowSpinner() && !json)

    try {
      if (web || app) {
        const workspace = getOption("workspace")
        if (!workspace) {
          throw new ValidationError(
            "workspace is not set via command line, configuration file, or environment",
          )
        }

        const url = `${LINEAR_WEB_BASE_URL}/${workspace}/settings/teams`
        const destination = app ? "Linear.app" : "web browser"
        console.log(`Opening ${url} in ${destination}`)
        const openMod = await import("open")
        await openMod.default(url, app ? { app: { name: "Linear" } } : undefined)
        return
      }

      spinner.start()

      const client = getGraphQLClient()

      // Fetch all teams with pagination
      const allTeams: GetTeamsQuery["teams"]["nodes"] = []
      let hasNextPage = true
      let after: string | null | undefined = undefined
      let pageInfo: NonNullable<GetTeamsQuery["teams"]>["pageInfo"] = {
        hasNextPage: false,
        endCursor: null,
      }

      while (hasNextPage) {
        const result: GetTeamsQuery = await client.request(GetTeams, {
          filter: undefined,
          first: 100,
          after,
        })

        const teams = result.teams?.nodes || []
        allTeams.push(...teams)

        pageInfo = result.teams?.pageInfo ?? { hasNextPage: false, endCursor: null }
        hasNextPage = pageInfo.hasNextPage
        after = pageInfo.endCursor
      }

      spinner.stop()

      // Filter out archived teams
      let teams = allTeams.filter((team) => !team.archivedAt)

      // Sort teams alphabetically by name
      teams = teams.sort((a, b) => a.name.localeCompare(b.name))

      if (json) {
        console.log(JSON.stringify({ nodes: teams, pageInfo }, null, 2))
        return
      }

      if (teams.length === 0) {
        console.log("No teams found.")
        return
      }

      // Define column widths based on actual data
      const { columns } = isStdoutTTY() ? getConsoleSize() : { columns: 120 }
      const ID_WIDTH = Math.max(
        2, // minimum width for "ID" header
        ...teams.map((team) => team.id.length),
      )
      const KEY_WIDTH = Math.max(
        3, // minimum width for "KEY" header
        ...teams.map((team) => team.key.length),
      )
      const CYCLES_WIDTH = Math.max(
        6, // minimum width for "CYCLES" header
        3, // "Yes" or "No"
      )
      const UPDATED_WIDTH = Math.max(
        7, // minimum width for "UPDATED" header
        ...teams.map((team) => getTimeAgo(new Date(team.updatedAt)).length),
      )

      const SPACE_WIDTH = 5
      const fixed = ID_WIDTH + KEY_WIDTH + CYCLES_WIDTH + UPDATED_WIDTH + SPACE_WIDTH
      const PADDING = 1
      const maxNameWidth = Math.max(...teams.map((team) => stringWidth(team.name)))
      const availableWidth = Math.max(columns - PADDING - fixed, 0)
      const nameWidth = Math.min(maxNameWidth, availableWidth)

      // Print header
      const headerCells = [
        padDisplay("KEY", KEY_WIDTH),
        padDisplay("NAME", nameWidth),
        padDisplay("CYCLES", CYCLES_WIDTH),
        padDisplay("UPDATED", UPDATED_WIDTH),
        padDisplay("ID", ID_WIDTH),
      ]

      let headerMsg = ""
      const headerStyles: string[] = []
      headerCells.forEach((cell, index) => {
        headerMsg += `%c${cell}`
        headerStyles.push("text-decoration: underline")
        if (index < headerCells.length - 1) {
          headerMsg += "%c %c"
          headerStyles.push("text-decoration: none")
          headerStyles.push("text-decoration: underline")
        }
      })
      console.log(applyConsoleFormat(headerMsg, ...headerStyles))

      // Print each team
      for (const team of teams) {
        const cycles = team.cyclesEnabled ? "Yes" : "No"
        const updated = getTimeAgo(new Date(team.updatedAt))

        const truncName =
          team.name.length > nameWidth
            ? team.name.slice(0, nameWidth - 3) + "..."
            : padDisplay(team.name, nameWidth)

        console.log(
          applyConsoleFormat(
            `%c${padDisplay(team.key, KEY_WIDTH)}%c ${truncName} ${padDisplay(
              cycles,
              CYCLES_WIDTH,
            )} %c${padDisplay(updated, UPDATED_WIDTH)}%c %c${padDisplay(team.id, ID_WIDTH)}%c`,
            `color: ${team.color || "#ffffff"}`,
            "",
            "color: gray",
            "",
            "color: gray",
            "",
          ),
        )
      }
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to fetch teams")
    }
  })
