import { createCommand } from "../../../src/commands/milestone/milestone-create.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Milestone Create Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await createCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test successful milestone creation
await snapshotTest({
  name: "Milestone Create Command - Success",
  meta: import.meta,
  colors: false,
  args: [
    "--project",
    "project-123",
    "--name",
    "Q1 Goals",
    "--description",
    "First quarter objectives",
    "--target-date",
    "2026-03-31",
  ],
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
        queryName: "CreateProjectMilestone",
        response: {
          data: {
            projectMilestoneCreate: {
              success: true,
              projectMilestone: {
                id: "milestone-new-1",
                name: "Q1 Goals",
                targetDate: "2026-03-31",
                project: {
                  id: "project-123",
                  name: "Test Project",
                },
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

      await createCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test milestone creation without optional fields
await snapshotTest({
  name: "Milestone Create Command - Minimal Fields",
  meta: import.meta,
  colors: false,
  args: ["--project", "project-456", "--name", "Simple Milestone"],
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
        queryName: "CreateProjectMilestone",
        response: {
          data: {
            projectMilestoneCreate: {
              success: true,
              projectMilestone: {
                id: "milestone-new-2",
                name: "Simple Milestone",
                targetDate: null,
                project: {
                  id: "project-456",
                  name: "Another Project",
                },
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

      await createCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
