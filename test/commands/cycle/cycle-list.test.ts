import { listCommand } from "../../../src/commands/cycle/cycle-list.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

await snapshotTest({
  name: "Cycle List Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await listCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

await snapshotTest({
  name: "Cycle List Command - With Mock Cycles",
  meta: import.meta,
  colors: false,
  args: ["--team", "ENG"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetTeamIdByKey",
        response: {
          data: {
            teams: {
              nodes: [{ id: "team-eng-id" }],
            },
          },
        },
      },
      {
        queryName: "GetTeamCycles",
        variables: { teamId: "team-eng-id" },
        response: {
          data: {
            team: {
              id: "team-eng-id",
              name: "Engineering",
              cycles: {
                nodes: [
                  {
                    id: "cycle-1",
                    number: 12,
                    name: "Sprint 12",
                    startsAt: "2026-02-10T00:00:00.000Z",
                    endsAt: "2026-02-24T00:00:00.000Z",
                    completedAt: "2026-02-24T00:00:00.000Z",
                    isActive: false,
                    isFuture: false,
                    isPast: true,
                  },
                  {
                    id: "cycle-2",
                    number: 13,
                    name: "Sprint 13",
                    startsAt: "2026-02-24T00:00:00.000Z",
                    endsAt: "2026-03-10T00:00:00.000Z",
                    completedAt: null,
                    isActive: true,
                    isFuture: false,
                    isPast: false,
                  },
                  {
                    id: "cycle-3",
                    number: 14,
                    name: "Sprint 14",
                    startsAt: "2026-03-10T00:00:00.000Z",
                    endsAt: "2026-03-24T00:00:00.000Z",
                    completedAt: null,
                    isActive: false,
                    isFuture: true,
                    isPast: false,
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

await snapshotTest({
  name: "Cycle List Command - No Cycles Found",
  meta: import.meta,
  colors: false,
  args: ["--team", "ENG"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetTeamIdByKey",
        response: {
          data: {
            teams: {
              nodes: [{ id: "team-eng-id" }],
            },
          },
        },
      },
      {
        queryName: "GetTeamCycles",
        variables: { teamId: "team-eng-id" },
        response: {
          data: {
            team: {
              id: "team-eng-id",
              name: "Engineering",
              cycles: {
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
