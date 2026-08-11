import { expect, test } from "bun:test"
import { NotFoundError } from "../../src/utils/errors.ts"
import {
  type WorkflowState,
  getIssueIdentifier,
  resolveWorkflowState,
  searchIssuesByTerm,
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
