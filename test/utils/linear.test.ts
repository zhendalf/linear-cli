import { expect, test } from "bun:test"
import { getIssueIdentifier, searchIssuesByTerm } from "../../src/utils/linear.ts"
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
