import { updateCommand } from "../../../src/commands/milestone/milestone-update.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Milestone Update Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test successful milestone update - name only
await snapshotTest({
  name: "Milestone Update Command - Update Name",
  meta: import.meta,
  colors: false,
  args: ["milestone-123", "--name", "Updated Milestone Name"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateProjectMilestone",
        response: {
          data: {
            projectMilestoneUpdate: {
              success: true,
              projectMilestone: {
                id: "milestone-123",
                name: "Updated Milestone Name",
                targetDate: "2026-03-31",
                sortOrder: 0,
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

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test milestone update - multiple fields
await snapshotTest({
  name: "Milestone Update Command - Update Multiple Fields",
  meta: import.meta,
  colors: false,
  args: [
    "milestone-456",
    "--name",
    "Q2 Goals",
    "--description",
    "Second quarter objectives",
    "--target-date",
    "2026-06-30",
  ],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateProjectMilestone",
        response: {
          data: {
            projectMilestoneUpdate: {
              success: true,
              projectMilestone: {
                id: "milestone-456",
                name: "Q2 Goals",
                targetDate: "2026-06-30",
                sortOrder: 1,
                project: {
                  id: "project-789",
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

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test milestone update - sort order only
await snapshotTest({
  name: "Milestone Update Command - Update Sort Order",
  meta: import.meta,
  colors: false,
  args: ["milestone-sort", "--sort-order", "5"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateProjectMilestone",
        response: {
          data: {
            projectMilestoneUpdate: {
              success: true,
              projectMilestone: {
                id: "milestone-sort",
                name: "Sorted Milestone",
                targetDate: "2026-06-15",
                sortOrder: 5,
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

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test milestone update - sort order zero (guards against truthiness-check regression)
await snapshotTest({
  name: "Milestone Update Command - Update Sort Order Zero",
  meta: import.meta,
  colors: false,
  args: ["milestone-zero", "--sort-order", "0"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateProjectMilestone",
        response: {
          data: {
            projectMilestoneUpdate: {
              success: true,
              projectMilestone: {
                id: "milestone-zero",
                name: "First Milestone",
                targetDate: "2026-01-15",
                sortOrder: 0,
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

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test milestone update - target date only
await snapshotTest({
  name: "Milestone Update Command - Update Target Date",
  meta: import.meta,
  colors: false,
  args: ["milestone-789", "--target-date", "2026-12-31"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateProjectMilestone",
        response: {
          data: {
            projectMilestoneUpdate: {
              success: true,
              projectMilestone: {
                id: "milestone-789",
                name: "Existing Milestone",
                targetDate: "2026-12-31",
                sortOrder: 2,
                project: {
                  id: "project-999",
                  name: "Final Project",
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

      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
