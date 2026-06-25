import {
  fetchIssueDetails,
  getIssueIdentifier,
  getStartedState,
  getTeamKey,
  updateIssueState,
} from "./linear.ts"
import { getOption } from "../config.ts"
import { getNoIssueFoundMessage, startVcsWork } from "./vcs.ts"
import { LINEAR_WEB_BASE_URL } from "../const.ts"

export async function openIssuePage(
  providedId?: string,
  options: { app?: boolean; web?: boolean } = {},
) {
  const issueId = await getIssueIdentifier(providedId)
  if (!issueId) {
    console.error(getNoIssueFoundMessage())
    process.exit(1)
  }

  const workspace = getOption("workspace")
  if (!workspace) {
    console.error(
      "workspace is not set via command line, configuration file, or environment.",
    )
    process.exit(1)
  }

  const url = `${LINEAR_WEB_BASE_URL}/${workspace}/issue/${issueId}`
  const destination = options.app ? "Linear.app" : "web browser"
  console.log(`Opening ${url} in ${destination}`)
  const openMod = await import("open")
  await openMod.default(url, options.app ? { app: { name: "Linear" } } : undefined)
}

export async function openProjectPage(
  projectId: string,
  options: { app?: boolean; web?: boolean } = {},
) {
  const workspace = getOption("workspace")
  if (!workspace) {
    console.error(
      "workspace is not set via command line, configuration file, or environment.",
    )
    process.exit(1)
  }

  const url = `${LINEAR_WEB_BASE_URL}/${workspace}/project/${projectId}`
  const destination = options.app ? "Linear.app" : "web browser"
  console.log(`Opening ${url} in ${destination}`)
  const openMod = await import("open")
  await openMod.default(url, options.app ? { app: { name: "Linear" } } : undefined)
}

export async function openTeamAssigneeView(options: { app?: boolean } = {}) {
  const teamId = getTeamKey()
  if (!teamId) {
    console.error(
      "Could not determine team id from configuration or directory name.",
    )
    process.exit(1)
  }

  const workspace = getOption("workspace")
  if (!workspace) {
    console.error(
      "workspace is not set via command line, configuration file, or environment.",
    )
    process.exit(1)
  }

  const filterObj = {
    "and": [{ "assignee": { "or": [{ "isMe": { "eq": true } }] } }],
  }
  // Base64-encode without padding (matches Deno encodeBase64 + replace)
  const filter = Buffer.from(JSON.stringify(filterObj))
    .toString("base64")
    .replace(/=/g, "")
  const url =
    `${LINEAR_WEB_BASE_URL}/${workspace}/team/${teamId}/active?filter=${filter}`
  const openMod = await import("open")
  await openMod.default(url, options.app ? { app: { name: "Linear" } } : undefined)
}

export async function startWorkOnIssue(
  issueId: string,
  teamId: string,
  gitSourceRef?: string,
  customBranchName?: string,
) {
  const { branchName: defaultBranchName } = await fetchIssueDetails(
    issueId,
    true,
  )
  const branchName = customBranchName || defaultBranchName

  // Start VCS work (git or jj)
  await startVcsWork(issueId, branchName, gitSourceRef)

  // Update issue state
  try {
    const state = await getStartedState(teamId)
    if (!issueId) {
      console.error("No issue ID resolved")
      process.exit(1)
    }
    await updateIssueState(issueId, state.id)
    console.log(`✓ Issue state updated to '${state.name}'`)
  } catch (error) {
    console.error("Failed to update issue state:", error)
  }
}
