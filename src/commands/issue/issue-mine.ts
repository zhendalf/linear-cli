import chalk from "chalk"
import { Command, Option } from "commander"
import stringWidth from "string-width"
import { getOption } from "../../config.ts"
import { openTeamAssigneeView } from "../../utils/actions.ts"
import { getPriorityDisplay, getTimeAgo, padDisplay, truncateText } from "../../utils/display.ts"
import { handleError, NotFoundError, ValidationError } from "../../utils/errors.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import {
  fetchIssuesForState,
  getCycleIdByNameOrNumber,
  getMilestoneIdByName,
  getProjectIdByName,
  getProjectOptionsByName,
  getTeamIdByKey,
  getTeamKey,
  isIssueBlocked,
  selectOption,
} from "../../utils/linear.ts"
import { collectEnum, ISSUE_STATE_TYPES } from "../../utils/option-parsers.ts"
import { pipeToUserPager, shouldUsePager } from "../../utils/pager.ts"
import { getConsoleSize, isStdinTTY, isStdoutTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"
import { header, muted, warning } from "../../utils/styling.ts"

export const mineCommand = new Command("mine")
  .alias("list")
  .alias("l")
  .description("List your issues")
  .addOption(
    new Option(
      "-s, --state <state>",
      "Filter by issue state (can be repeated for multiple states)",
    ).argParser(collectEnum(ISSUE_STATE_TYPES, "state")),
  )
  .option("--all-states", "Show issues from all states")
  .addOption(
    new Option("--sort <sort>", "Sort order (can also be set via LINEAR_ISSUE_SORT)").choices([
      "manual",
      "priority",
    ]),
  )
  .option("--team <team>", "Team to list issues for (if not your default team)")
  .option("--project <project>", "Filter by project name")
  .option(
    "--project-label <projectLabel>",
    "Filter by project label name (shows issues from all projects with this label)",
  )
  .option("--cycle <cycle>", "Filter by cycle name, number, or 'active'")
  .option("--milestone <milestone>", "Filter by project milestone name (requires --project)")
  .option(
    "-l, --label <label>",
    "Filter by label name (can be repeated for multiple labels)",
    (val: string, prev: string[] = []) => [...prev, val],
  )
  .addOption(
    new Option(
      "--limit <n>",
      "Maximum number of issues to fetch (default: 50, use 0 for unlimited)",
    )
      .argParser(Number)
      .default(50),
  )
  .option(
    "--created-after <date>",
    "Filter issues created after this date (ISO 8601 or YYYY-MM-DD)",
  )
  .option(
    "--updated-after <date>",
    "Filter issues updated after this date (ISO 8601 or YYYY-MM-DD)",
  )
  .addOption(
    new Option("--assignee <assignee>", "Removed: use `issue query --assignee` instead").hideHelp(),
  )
  .addOption(
    new Option(
      "-A, --all-assignees",
      "Removed: use `issue query --all-assignees` instead",
    ).hideHelp(),
  )
  .addOption(
    new Option("-U, --unassigned", "Removed: use `issue query --unassigned` instead").hideHelp(),
  )
  .option("-w, --web", "Open in web browser")
  .option("-a, --app", "Open in Linear.app")
  .option("--no-pager", "Disable automatic paging for long output")
  .action(async (options) => {
    const {
      sort: sortFlag,
      state,
      allStates,
      assignee,
      allAssignees,
      unassigned,
      web,
      app,
      team,
      project,
      projectLabel,
      cycle,
      milestone,
      label: labels,
      limit,
      pager,
      createdAfter,
      updatedAfter,
    } = options

    const usePager = pager !== false
    if (web || app) {
      await openTeamAssigneeView({ app: app })
      return
    }

    try {
      if (assignee != null || allAssignees || unassigned) {
        const flag =
          assignee != null ? "--assignee" : allAssignees ? "--all-assignees" : "--unassigned"
        throw new ValidationError(`${flag} has been removed from 'issue mine'`, {
          suggestion: `Use 'linear issue query ${flag}' for assignee filtering.`,
        })
      }
      // Default only applies when --state was not given (see option-parsers.ts:
      // accumulators must not carry a commander .default()).
      if (allStates && state) {
        throw new ValidationError("Cannot use --all-states with --state flag")
      }
      const stateArray: string[] = state ?? ["unstarted"]

      // Default to "priority" when no sort is supplied anywhere (flag, config,
      // or LINEAR_ISSUE_SORT) so `issue mine` works out of the box.
      const sort =
        sortFlag || (getOption("issue_sort") as "manual" | "priority" | undefined) || "priority"
      const validSortValues = ["manual", "priority"]
      if (!validSortValues.includes(sort)) {
        throw new ValidationError(`Sort must be one of: ${validSortValues.join(", ")}`)
      }
      const teamKey = team || getTeamKey()
      if (!teamKey) {
        throw new ValidationError("No team configured and no team scope provided", {
          suggestion:
            "Use --team <key> to specify a team, or run from a directory named after the team key. To query across all teams, use 'linear issue query --all-teams'.",
        })
      }

      if (project != null && projectLabel != null) {
        throw new ValidationError("Cannot use --project and --project-label together", {
          suggestion:
            "Use --project to filter by a single project, or --project-label to filter by all projects with a given label.",
        })
      }

      let projectId: string | undefined
      if (project != null) {
        projectId = await getProjectIdByName(project)
        if (projectId == null) {
          const projectOptions = await getProjectOptionsByName(project)
          if (Object.keys(projectOptions).length === 0) {
            throw new NotFoundError("Project", project)
          }
          if (!isStdinTTY()) {
            throw new ValidationError(
              `Project "${project}" not found. Similar projects: ${Object.values(
                projectOptions,
              ).join(", ")}`,
            )
          }
          projectId = await selectOption("Project", project, projectOptions)
        }
      }

      let cycleId: string | undefined
      if (cycle != null) {
        const teamId = await getTeamIdByKey(teamKey)
        if (!teamId) {
          throw new NotFoundError("Team", teamKey)
        }
        cycleId = await getCycleIdByNameOrNumber(cycle, teamId)
      }

      let milestoneId: string | undefined
      if (milestone != null) {
        if (projectLabel != null) {
          throw new ValidationError("--milestone cannot be used with --project-label", {
            suggestion: "Use --project to specify a single project when filtering by milestone.",
          })
        }
        if (projectId == null) {
          throw new ValidationError("--milestone requires --project to be set", {
            suggestion: "Use --project to specify which project the milestone belongs to.",
          })
        }
        milestoneId = await getMilestoneIdByName(milestone, projectId)
      }

      const labelNames = labels && labels.length > 0 ? labels.flat() : undefined

      const spinner = createSpinner("", shouldShowSpinner())
      spinner.start()

      const result = await fetchIssuesForState(
        teamKey,
        allStates ? undefined : stateArray,
        undefined, // assignee — always self
        false, // unassigned
        false, // allAssignees
        limit === 0 ? undefined : limit,
        projectId,
        sort,
        cycleId,
        milestoneId,
        projectLabel,
        labelNames,
        createdAfter,
        updatedAfter,
      )
      spinner.stop()
      const issues = result.issues?.nodes || []

      if (issues.length === 0) {
        console.log("No issues found.")
        return
      }

      const { columns } = isStdoutTTY() ? getConsoleSize() : { columns: 120 }
      const PRIORITY_WIDTH = 3
      const BLOCKED_WIDTH = 1
      const ID_WIDTH = Math.max(
        2, // minimum width for "ID" header
        ...issues.map((issue) => issue.identifier.length),
      )
      const LABEL_WIDTH = Math.min(
        25, // maximum width for labels column
        Math.max(
          6, // minimum width for "LABELS" header
          ...issues.map((issue) => stringWidth(issue.labels.nodes.map((l) => l.name).join(", "))),
        ),
      )
      const ESTIMATE_WIDTH = 1 // fixed width for estimate
      const STATE_WIDTH = Math.min(
        20, // maximum width for state
        Math.max(
          5, // minimum width for "STATE" header
          ...issues.map((issue) => stringWidth(issue.state.name)),
        ),
      )
      const SPACE_WIDTH = 4
      const updatedHeader = "UPDATED"
      const UPDATED_WIDTH = Math.max(
        stringWidth(updatedHeader),
        ...issues.map((issue) => stringWidth(getTimeAgo(new Date(issue.updatedAt)))),
      )

      type TableRow = {
        priorityStr: string
        blockedStr: string
        identifier: string
        title: string
        labels: string
        state: string
        timeAgo: string
        estimate: number | null | undefined
      }

      const tableData: Array<TableRow> = issues.map((issue) => {
        let labelsStr: string
        if (issue.labels.nodes.length === 0) {
          labelsStr = " ".repeat(LABEL_WIDTH)
        } else {
          const coloredLabels: string[] = []
          let currentWidth = 0

          for (let i = 0; i < issue.labels.nodes.length; i++) {
            const label = issue.labels.nodes[i]
            const coloredLabel = chalk.hex(label.color)(label.name)
            const separator = i > 0 ? ", " : ""
            const testText = separator + label.name

            if (currentWidth + stringWidth(testText) > LABEL_WIDTH) {
              const remainingWidth = LABEL_WIDTH - currentWidth
              if (remainingWidth >= 4) {
                // Need at least 4 chars for "..."
                const truncatedName = truncateText(label.name, remainingWidth - separator.length)
                coloredLabels.push(separator + chalk.hex(label.color)(truncatedName))
              }
              break
            }

            coloredLabels.push(separator + coloredLabel)
            currentWidth += stringWidth(testText)
          }

          labelsStr = coloredLabels.join("")
          const ansiRegex = new RegExp("\\[[0-9;]*m", "g")
          const actualLabelsWidth = stringWidth(coloredLabels.join("").replace(ansiRegex, ""))
          const remainingSpace = Math.max(0, LABEL_WIDTH - actualLabelsWidth)
          labelsStr += " ".repeat(remainingSpace)
        }
        const updatedAt = new Date(issue.updatedAt)
        const timeAgo = getTimeAgo(updatedAt)

        const priorityStr = getPriorityDisplay(issue.priority)

        const stateName = truncateText(issue.state.name, STATE_WIDTH)
        const stateColored = chalk.hex(issue.state.color)(stateName)
        const stateRemainingSpace = Math.max(0, STATE_WIDTH - stringWidth(stateName))
        const statePadded = stateColored + " ".repeat(stateRemainingSpace)

        const blockedStr = isIssueBlocked(issue) ? warning("⊘") : " "

        return {
          priorityStr,
          blockedStr,
          identifier: issue.identifier,
          title: issue.title,
          labels: labelsStr,
          state: statePadded,
          timeAgo,
          estimate: issue.estimate,
        }
      })

      const fixed =
        PRIORITY_WIDTH +
        BLOCKED_WIDTH +
        ID_WIDTH +
        UPDATED_WIDTH +
        SPACE_WIDTH +
        LABEL_WIDTH +
        ESTIMATE_WIDTH +
        STATE_WIDTH +
        SPACE_WIDTH
      const PADDING = 1
      const maxTitleWidth = Math.max(...tableData.map((row) => stringWidth(row.title)))
      const availableWidth = Math.max(columns - PADDING - fixed, 0)
      const titleWidth = Math.min(maxTitleWidth, availableWidth) // use smaller of max title width or available space
      const headerCells = [
        padDisplay("◌", PRIORITY_WIDTH),
        padDisplay("ID", ID_WIDTH),
        padDisplay("TITLE", titleWidth),
        padDisplay("LABELS", LABEL_WIDTH),
        padDisplay("B", BLOCKED_WIDTH),
        padDisplay("E", ESTIMATE_WIDTH),
        padDisplay("STATE", STATE_WIDTH),
        padDisplay(updatedHeader, UPDATED_WIDTH),
      ]

      const formattedHeaderLine = header(headerCells.join(" "))

      const outputLines: string[] = []

      outputLines.push(formattedHeaderLine)

      for (const row of tableData) {
        const { priorityStr, blockedStr, identifier, title, labels, state, timeAgo, estimate } = row
        const truncTitle = padDisplay(truncateText(title, titleWidth), titleWidth)

        const issueLine = `${padDisplay(priorityStr, PRIORITY_WIDTH)} ${padDisplay(
          identifier,
          ID_WIDTH,
        )} ${truncTitle} ${labels} ${padDisplay(blockedStr, BLOCKED_WIDTH)} ${padDisplay(
          estimate?.toString() || "-",
          ESTIMATE_WIDTH,
        )} ${state} ${muted(padDisplay(timeAgo, UPDATED_WIDTH))}`
        outputLines.push(issueLine)
      }

      if (shouldUsePager(outputLines, usePager)) {
        await pipeToUserPager(outputLines.join("\n"))
      } else {
        for (const line of outputLines) console.log(line)
      }
    } catch (error) {
      handleError(error, "Failed to list issues")
    }
  })
