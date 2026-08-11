import { expect, test } from "bun:test"
import { NotFoundError, ValidationError } from "../../src/utils/errors.ts"
import {
  getIssueIdentifier,
  resolveWorkflowState,
  searchIssuesByTerm,
  type WorkflowState,
  workflowStateNotFoundError,
} from "../../src/utils/linear.ts"
import { setupMockLinearServer } from "./test-helpers.ts"

test("getIssueId - handles full issue identifiers", async () => {
  const result = await getIssueIdentifier("ABC-123")
  expect(result).toBe("ABC-123")
})

test("getIssueId - handles integer-only IDs with team prefix", async () => {
  process.env["LINEAR_TEAM_ID"] = "CLI"

  const result = await getIssueIdentifier("123")
  expect(result).toBe("CLI-123")

  delete process.env["LINEAR_TEAM_ID"]
})

test("getIssueId - rejects invalid integer patterns", async () => {
  process.env["LINEAR_TEAM_ID"] = "TEST"

  const result = await getIssueIdentifier("0123") // Leading zero should be rejected
  expect(result).toBeUndefined()

  delete process.env["LINEAR_TEAM_ID"]
})

test("getIssueId - rejects zero", async () => {
  process.env["LINEAR_TEAM_ID"] = "TEST"

  const result = await getIssueIdentifier("0")
  expect(result).toBeUndefined()

  delete process.env["LINEAR_TEAM_ID"]
})

test("searchIssuesByTerm - without limit fetches a single page", async () => {
  const { cleanup } = await setupMockLinearServer(
    [
      {
        queryName: "SearchIssues",
        variables: {
          term: "issue",
          filter: {
            team: { key: { eq: "CLI" } },
          },
        },
        response: {
          data: {
            searchIssues: {
              nodes: [
                {
                  id: "issue-1",
                  identifier: "CLI-1",
                  title: "First issue",
                  url: "https://linear.app/acme/issue/CLI-1/first-issue",
                  priority: 2,
                  priorityLabel: "High",
                  estimate: 3,
                  createdAt: "2026-04-01T10:00:00.000Z",
                  updatedAt: "2026-04-01T10:00:00.000Z",
                  state: {
                    id: "state-1",
                    name: "Backlog",
                    color: "#999999",
                    type: "backlog",
                  },
                  assignee: null,
                  team: {
                    id: "team-1",
                    key: "CLI",
                    name: "Linear CLI",
                  },
                  project: null,
                  projectMilestone: null,
                  cycle: null,
                  labels: { nodes: [] },
                  inverseRelations: { nodes: [] },
                  metadata: {},
                },
              ],
              pageInfo: {
                hasNextPage: true,
                endCursor: "cursor-1",
              },
              totalCount: 2,
            },
          },
        },
      },
    ],
    { NO_COLOR: "true" },
  )

  try {
    const result = await searchIssuesByTerm("issue", {
      teamKey: "CLI",
    })

    expect(result).toEqual({
      nodes: [
        {
          id: "issue-1",
          identifier: "CLI-1",
          title: "First issue",
          url: "https://linear.app/acme/issue/CLI-1/first-issue",
          priority: 2,
          priorityLabel: "High",
          estimate: 3,
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
          state: {
            id: "state-1",
            name: "Backlog",
            color: "#999999",
            type: "backlog",
          },
          assignee: null,
          team: {
            id: "team-1",
            key: "CLI",
            name: "Linear CLI",
          },
          project: null,
          projectMilestone: null,
          cycle: null,
          labels: { nodes: [] },
          inverseRelations: { nodes: [] },
          metadata: {},
        },
      ],
      pageInfo: {
        hasNextPage: true,
        endCursor: "cursor-1",
      },
      totalCount: 2,
    })
  } finally {
    await cleanup()
  }
})

// States reach resolveWorkflowState already sorted by position, mirroring
// getWorkflowStates. The two "started" states are ordered so the lower position
// comes first.
const WORKFLOW_STATES: WorkflowState[] = [
  { id: "s-backlog", name: "Backlog", type: "backlog", position: 0 },
  { id: "s-todo", name: "Todo", type: "unstarted", position: 1 },
  { id: "s-progress", name: "In Progress", type: "started", position: 2 },
  { id: "s-review", name: "In Review", type: "started", position: 3 },
  { id: "s-done", name: "Done", type: "completed", position: 4 },
]

test("resolveWorkflowState - matches by exact name, case-insensitively", () => {
  expect(resolveWorkflowState(WORKFLOW_STATES, "in progress")?.id).toBe("s-progress")
})

test("resolveWorkflowState - name match wins over type match", () => {
  // "Done" is a name and "completed" is its type; the name resolves first.
  expect(resolveWorkflowState(WORKFLOW_STATES, "Done")?.id).toBe("s-done")
})

test("resolveWorkflowState - matches by type when no name matches", () => {
  expect(resolveWorkflowState(WORKFLOW_STATES, "COMPLETED")?.id).toBe("s-done")
})

test("resolveWorkflowState - duplicate types resolve to the first by position", () => {
  expect(resolveWorkflowState(WORKFLOW_STATES, "started")?.id).toBe("s-progress")
})

test("resolveWorkflowState - returns undefined when nothing matches", () => {
  expect(resolveWorkflowState(WORKFLOW_STATES, "nope")).toBeUndefined()
})

test("workflowStateNotFoundError - lists valid states and the discovery command", () => {
  const error = workflowStateNotFoundError("ENG", "nope", [
    { id: "s-backlog", name: "Backlog", type: "backlog", position: 0 },
    { id: "s-todo", name: "Todo", type: "unstarted", position: 1 },
  ])

  expect(error).toBeInstanceOf(NotFoundError)
  expect(error.message).toBe("Workflow state not found: 'nope' for team ENG")
  expect(error.suggestion).toBe(
    'Valid states: "Backlog" (backlog), "Todo" (unstarted). ' +
      "Run `linear team states ENG` to list them.",
  )
})

test("workflowStateNotFoundError - escapes quotes in state names", () => {
  const error = workflowStateNotFoundError("ENG", "nope", [
    { id: "s-weird", name: 'Needs "review"', type: "started", position: 0 },
  ])

  expect(error.suggestion).toContain('"Needs \\"review\\"" (started)')
})

test("workflowStateNotFoundError - handles a team with no states", () => {
  const error = workflowStateNotFoundError("ENG", "nope", [])

  expect(error.suggestion).toBe("Team ENG has no workflow states. Run `linear team states ENG`.")
})

// An empty team id is falsy, so getTeamKey() resolves to nothing even though
// the repo's own .linear.toml sets one — this reaches the no-team branch.
test("getIssueId - integer-only id without a team points at `linear config`", async () => {
  process.env["LINEAR_TEAM_ID"] = ""

  try {
    let caught: unknown
    try {
      await getIssueIdentifier("123")
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(ValidationError)
    const error = caught as ValidationError
    expect(error.message).toContain("no team is set")
    // Regression guard: the suggestion must name the real `config` command.
    // `linear configure` used to be advertised here and is an alias now, but
    // the canonical spelling is what we tell people to run.
    expect(error.suggestion).toContain("linear config")
    expect(error.suggestion).not.toContain("linear configure")
  } finally {
    delete process.env["LINEAR_TEAM_ID"]
  }
})

// Regression: `issue query --search --cycle` resolved a cycle id and then
// dropped it, because searchIssuesByTerm took no cycle parameter and silently
// returned unfiltered results. The mock only answers when the cycle filter is
// present, so a dropped filter fails the request instead of passing quietly.
test("searchIssuesByTerm - threads cycleId into the search filter", async () => {
  const { cleanup } = await setupMockLinearServer(
    [
      {
        queryName: "SearchIssues",
        variables: {
          term: "issue",
          filter: {
            team: { key: { eq: "CLI" } },
            cycle: { id: { eq: "cycle-1" } },
          },
        },
        response: {
          data: {
            searchIssues: {
              nodes: [],
              pageInfo: { hasNextPage: false, endCursor: null },
              totalCount: 0,
            },
          },
        },
      },
    ],
    { NO_COLOR: "true" },
  )

  try {
    const result = await searchIssuesByTerm("issue", {
      teamKey: "CLI",
      cycleId: "cycle-1",
    })

    expect(result.nodes).toEqual([])
    expect(result.totalCount).toBe(0)
  } finally {
    await cleanup()
  }
})
