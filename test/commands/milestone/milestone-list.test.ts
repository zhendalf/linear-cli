import { listCommand } from "../../../src/commands/milestone/milestone-list.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Milestone List Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test with mock server - Milestones list
await snapshotTest({
  name: "Milestone List Command - With Mock Milestones",
  meta: import.meta,
  colors: false,
  args: ["--project", "project-123"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetProjectBySlug",
        response: {
          data: {
            projects: {
              nodes: [
                {
                  id: "project-123",
                  slugId: "project-123",
                },
              ],
            },
          },
        },
      },
      {
        queryName: "GetProjectMilestones",
        variables: { projectId: "project-123" },
        response: {
          data: {
            project: {
              id: "project-123",
              name: "Test Project",
              projectMilestones: {
                nodes: [
                  {
                    id: "milestone-1",
                    name: "Infrastructure Foundation",
                    targetDate: "2026-01-31",
                    sortOrder: 1,
                    project: {
                      id: "project-123",
                      name: "Test Project",
                    },
                  },
                  {
                    id: "milestone-2",
                    name: "Observation Phase",
                    targetDate: "2026-02-28",
                    sortOrder: 2,
                    project: {
                      id: "project-123",
                      name: "Test Project",
                    },
                  },
                  {
                    id: "milestone-3",
                    name: "Safe Enablement",
                    targetDate: "2026-03-31",
                    sortOrder: 3,
                    project: {
                      id: "project-123",
                      name: "Test Project",
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test with empty milestones list
await snapshotTest({
  name: "Milestone List Command - No Milestones Found",
  meta: import.meta,
  colors: false,
  args: ["--project", "project-456"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetProjectBySlug",
        response: {
          data: {
            projects: {
              nodes: [
                {
                  id: "project-456",
                  slugId: "project-456",
                },
              ],
            },
          },
        },
      },
      {
        queryName: "GetProjectMilestones",
        variables: { projectId: "project-456" },
        response: {
          data: {
            project: {
              id: "project-456",
              name: "Empty Project",
              projectMilestones: {
                nodes: [],
              },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
