import { updateCommand } from "../../../src/commands/issue/issue-update.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// Test help output
await snapshotTest({
  name: "Issue Update Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test updating an issue with flags (happy path)
await snapshotTest({
  name: "Issue Update Command - Happy Path",
  meta: import.meta,
  colors: false,
  args: [
    "ENG-123",
    "--title",
    "Updated authentication bug fix",
    "--description",
    "Updated description for login issues",
    "--assignee",
    "self",
    "--priority",
    "1",
    "--estimate",
    "5",
  ],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        // Mock response for getTeamIdByKey() - converting team key to ID
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: {
            data: {
              teams: {
                nodes: [{ id: "team-eng-id" }],
              },
            },
          },
        },
        // Mock response for lookupUserId("self") - resolves to viewer
        {
          queryName: "GetViewerId",
          variables: {},
          response: {
            data: {
              viewer: {
                id: "user-self-123",
              },
            },
          },
        },
        // Mock response for the update issue mutation
        {
          queryName: "UpdateIssue",
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/updated-authentication-bug-fix",
                  title: "Updated authentication bug fix",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Test updating an issue with an alphanumeric team key
await snapshotTest({
  name: "Issue Update Command - Alphanumeric Team Key",
  meta: import.meta,
  colors: false,
  args: ["PLA4-16916", "--description", "new description"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      // Mock response for getTeamIdByKey() - team keys may contain digits
      {
        queryName: "GetTeamIdByKey",
        variables: { team: "PLA4" },
        response: {
          data: {
            teams: {
              nodes: [{ id: "team-pla4-id" }],
            },
          },
        },
      },
      // Mock response for the update issue mutation
      {
        queryName: "UpdateIssue",
        response: {
          data: {
            issueUpdate: {
              success: true,
              issue: {
                id: "issue-pla4-16916",
                identifier: "PLA4-16916",
                url: "https://linear.app/test-team/issue/PLA4-16916/test-issue",
                title: "Test Issue",
              },
            },
          },
        },
      },
    ])

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Test updating an issue with milestone
await snapshotTest({
  name: "Issue Update Command - With Milestone",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--project", "My Project", "--milestone", "Phase 1"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        // Mock response for getTeamIdByKey()
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: {
            data: {
              teams: {
                nodes: [{ id: "team-eng-id" }],
              },
            },
          },
        },
        // Mock response for getProjectIdByName()
        {
          queryName: "GetProjectIdByName",
          variables: { name: "My Project" },
          response: {
            data: {
              projects: {
                nodes: [{ id: "project-123" }],
              },
            },
          },
        },
        // Mock response for getMilestoneIdByName()
        {
          queryName: "GetProjectMilestonesForLookup",
          variables: { projectId: "project-123" },
          response: {
            data: {
              project: {
                projectMilestones: {
                  nodes: [
                    { id: "milestone-1", name: "Phase 1" },
                    { id: "milestone-2", name: "Phase 2" },
                  ],
                },
              },
            },
          },
        },
        // Mock response for the update issue mutation
        {
          queryName: "UpdateIssue",
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/test-issue",
                  title: "Test Issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Test updating an issue with case-insensitive label matching
await snapshotTest({
  name: "Issue Update Command - Case Insensitive Label Matching",
  meta: import.meta,
  colors: false,
  args: [
    "ENG-123",
    "--label",
    "FRONTEND", // uppercase label that should match "frontend" label
  ],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        // Mock response for getTeamIdByKey() - converting team key to ID
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: {
            data: {
              teams: {
                nodes: [{ id: "team-eng-id" }],
              },
            },
          },
        },
        // Mock response for getIssueLabelIdByNameForTeam("FRONTEND", "ENG") - case insensitive
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "FRONTEND", teamKey: "ENG" },
          response: {
            data: {
              issueLabels: {
                nodes: [
                  {
                    id: "label-frontend-456",
                    name: "frontend", // actual label is lowercase
                  },
                ],
              },
            },
          },
        },
        // Mock response for the update issue mutation
        {
          queryName: "UpdateIssue",
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/test-issue",
                  title: "Test Issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Test that -p is priority (not parent), resolving the flag conflict
await snapshotTest({
  name: "Issue Update Command - Short Flag -p Is Priority",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "-p", "2", "--parent", "ENG-220"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        // Mock response for getTeamIdByKey()
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: {
            data: {
              teams: {
                nodes: [{ id: "team-eng-id" }],
              },
            },
          },
        },
        // Mock response for getIssueId("ENG-220") - resolves parent identifier to ID
        {
          queryName: "GetIssueId",
          variables: { id: "ENG-220" },
          response: {
            data: {
              issue: {
                id: "parent-issue-id",
              },
            },
          },
        },
        // Mock response for the update issue mutation
        {
          queryName: "UpdateIssue",
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/test-issue",
                  title: "Test Issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

/**
 * Runs the command against a dead endpoint so any network call fails loudly.
 * Used by conflict-validation tests: the guard sits at the top of the action,
 * so these must fail with the validation message BEFORE any HTTP. If the guard
 * is ever moved below the network calls, the snapshot shows a connection error
 * instead. The endpoint is pinned to a dead port so a regression can never
 * reach the real Linear API using inherited credentials.
 */
async function runWithDeadEndpoint() {
  const prevEndpoint = process.env["LINEAR_GRAPHQL_ENDPOINT"]
  process.env["LINEAR_GRAPHQL_ENDPOINT"] = "http://127.0.0.1:1"
  process.env["LINEAR_API_KEY"] = "Bearer test-token"
  try {
    await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
  } finally {
    if (prevEndpoint === undefined) {
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
    } else {
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = prevEndpoint
    }
    delete process.env["LINEAR_API_KEY"]
  }
}

// Test updating an issue with cycle
await snapshotTest({
  name: "Issue Update Command - With Cycle",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--cycle", "Sprint 7"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        // Mock response for getTeamIdByKey()
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: {
            data: {
              teams: {
                nodes: [{ id: "team-eng-id" }],
              },
            },
          },
        },
        // Mock response for getCycleIdByNameOrNumber()
        {
          queryName: "GetTeamCyclesForLookup",
          variables: { teamId: "team-eng-id" },
          response: {
            data: {
              team: {
                cycles: {
                  nodes: [
                    { id: "cycle-1", number: 7, name: "Sprint 7" },
                    { id: "cycle-2", number: 8, name: "Sprint 8" },
                  ],
                },
                activeCycle: { id: "cycle-1", number: 7, name: "Sprint 7" },
              },
            },
          },
        },
        // Mock response for the update issue mutation
        {
          queryName: "UpdateIssue",
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/test-issue",
                  title: "Test Issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// --unassign must send `assigneeId: null` on the wire. The mock's `input` is
// matched with an exact key-count comparison (mock_linear_server.ts deepEqual),
// so this only matches if assigneeId is present AND null: dropping to
// `undefined` erases the key during JSON.stringify, and sending a user id
// fails the value comparison. Do not relax `variables` to an unconstrained
// mock — that would match any payload and prove nothing.
await snapshotTest({
  name: "Issue Update Command - Unassign Clears Assignee",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--unassign"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        // No GetViewerId mock: --unassign must not perform a user lookup.
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: { assigneeId: null, teamId: "team-eng-id" },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/some-issue",
                  title: "Some issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// --unassign alongside another field: the null must not clobber, or be
// clobbered by, sibling assignments.
await snapshotTest({
  name: "Issue Update Command - Unassign With Other Fields",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--unassign", "--title", "Renamed"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: { title: "Renamed", assigneeId: null, teamId: "team-eng-id" },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/renamed",
                  title: "Renamed",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Regression guard for the --assignee path: it must still send a string id.
// The "Happy Path" test above cannot catch a break here because its
// UpdateIssue mock declares no `variables` and matches any payload.
await snapshotTest({
  name: "Issue Update Command - Assignee Still Sends User Id",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--assignee", "self"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetViewerId",
          variables: {},
          response: { data: { viewer: { id: "user-self-123" } } },
        },
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: { assigneeId: "user-self-123", teamId: "team-eng-id" },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/some-issue",
                  title: "Some issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

await snapshotTest({
  name: "Issue Update Command - Assignee And Unassign Conflict",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--assignee", "self", "--unassign"],
  canFail: true,
  async fn() {
    await runWithDeadEndpoint()
  },
})

// --clear-cycle must send `cycleId: null` on the wire. Like --unassign above,
// the exact-variables mock proves both presence and null value. No
// GetTeamCyclesForLookup mock: clearing must not perform a cycle lookup.
await snapshotTest({
  name: "Issue Update Command - Clear Cycle Sends Null",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--clear-cycle"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: { cycleId: null, teamId: "team-eng-id" },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/some-issue",
                  title: "Some issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

await snapshotTest({
  name: "Issue Update Command - Cycle And Clear Cycle Conflict",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--cycle", "Sprint 7", "--clear-cycle"],
  canFail: true,
  async fn() {
    await runWithDeadEndpoint()
  },
})

// --add-label must send `addedLabelIds` and must NOT send `labelIds` — the
// exact-variables mock proves the incremental field is used and the replace
// field is absent (a wrong payload falls through to "no mock configured").
await snapshotTest({
  name: "Issue Update Command - Add Label Sends addedLabelIds",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--add-label", "frontend"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "frontend", teamKey: "ENG" },
          response: {
            data: {
              issueLabels: { nodes: [{ id: "label-frontend-456", name: "frontend" }] },
            },
          },
        },
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: { addedLabelIds: ["label-frontend-456"], teamId: "team-eng-id" },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/some-issue",
                  title: "Some issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Case variants resolving to the same label collapse to a single ID.
await snapshotTest({
  name: "Issue Update Command - Add Label Dedupes Case Variants",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--add-label", "Bug", "--add-label", "BUG"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "Bug", teamKey: "ENG" },
          response: {
            data: { issueLabels: { nodes: [{ id: "label-bug-123", name: "bug" }] } },
          },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "BUG", teamKey: "ENG" },
          response: {
            data: { issueLabels: { nodes: [{ id: "label-bug-123", name: "bug" }] } },
          },
        },
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: { addedLabelIds: ["label-bug-123"], teamId: "team-eng-id" },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/some-issue",
                  title: "Some issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// The detach workflow: remove a stale label from one issue without deleting it
// team-wide. No issue-read mock exists, so an accidental pre-read of the
// issue's current labels would fail this test.
await snapshotTest({
  name: "Issue Update Command - Remove Label Sends removedLabelIds",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--remove-label", "sprint-42"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "sprint-42", teamKey: "ENG" },
          response: {
            data: {
              issueLabels: { nodes: [{ id: "label-sprint-42", name: "sprint-42" }] },
            },
          },
        },
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: { removedLabelIds: ["label-sprint-42"], teamId: "team-eng-id" },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/some-issue",
                  title: "Some issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Add and remove compose into ONE atomic mutation carrying both arrays.
await snapshotTest({
  name: "Issue Update Command - Add And Remove Label In One Update",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--add-label", "sprint-43", "--remove-label", "sprint-42"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "sprint-43", teamKey: "ENG" },
          response: {
            data: {
              issueLabels: { nodes: [{ id: "label-sprint-43", name: "sprint-43" }] },
            },
          },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "sprint-42", teamKey: "ENG" },
          response: {
            data: {
              issueLabels: { nodes: [{ id: "label-sprint-42", name: "sprint-42" }] },
            },
          },
        },
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: {
              addedLabelIds: ["label-sprint-43"],
              removedLabelIds: ["label-sprint-42"],
              teamId: "team-eng-id",
            },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/some-issue",
                  title: "Some issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// The legacy replace path: --label must still send labelIds (deduped) and no
// incremental fields. The older --label tests don't pin UpdateIssue variables,
// so this is the test that actually proves replace semantics on the wire.
await snapshotTest({
  name: "Issue Update Command - Label Replace Sends Exact labelIds",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--label", "Frontend", "--label", "FRONTEND"],
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "Frontend", teamKey: "ENG" },
          response: {
            data: {
              issueLabels: { nodes: [{ id: "label-frontend-456", name: "frontend" }] },
            },
          },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "FRONTEND", teamKey: "ENG" },
          response: {
            data: {
              issueLabels: { nodes: [{ id: "label-frontend-456", name: "frontend" }] },
            },
          },
        },
        {
          queryName: "UpdateIssue",
          variables: {
            id: "ENG-123",
            input: { labelIds: ["label-frontend-456"], teamId: "team-eng-id" },
          },
          response: {
            data: {
              issueUpdate: {
                success: true,
                issue: {
                  id: "issue-existing-123",
                  identifier: "ENG-123",
                  url: "https://linear.app/test-team/issue/ENG-123/some-issue",
                  title: "Some issue",
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Conflict matrix: every invalid label-flag combination errors before any
// network call (dead endpoint, like the --assignee/--unassign conflict test).
await snapshotTest({
  name: "Issue Update Command - Label And Add Label Conflict",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--label", "bug", "--add-label", "infra"],
  canFail: true,
  async fn() {
    await runWithDeadEndpoint()
  },
})

await snapshotTest({
  name: "Issue Update Command - Label And Remove Label Conflict",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--label", "bug", "--remove-label", "infra"],
  canFail: true,
  async fn() {
    await runWithDeadEndpoint()
  },
})

// Label names resolve against the destination team, so a team move plus
// incremental label changes is ambiguous — rejected until designed.
await snapshotTest({
  name: "Issue Update Command - Team Move And Add Label Conflict",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--team", "OPS", "--add-label", "bug"],
  canFail: true,
  async fn() {
    await runWithDeadEndpoint()
  },
})

await snapshotTest({
  name: "Issue Update Command - Team Move And Remove Label Conflict",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--team", "OPS", "--remove-label", "bug"],
  canFail: true,
  async fn() {
    await runWithDeadEndpoint()
  },
})

// Same label (via case variants resolving to one ID) in both --add-label and
// --remove-label is ambiguous. No UpdateIssue mock: the error must fire
// before the mutation.
await snapshotTest({
  name: "Issue Update Command - Add And Remove Same Label Conflict",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--add-label", "Bug", "--remove-label", "BUG"],
  canFail: true,
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "Bug", teamKey: "ENG" },
          response: {
            data: { issueLabels: { nodes: [{ id: "label-bug-123", name: "bug" }] } },
          },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "BUG", teamKey: "ENG" },
          response: {
            data: { issueLabels: { nodes: [{ id: "label-bug-123", name: "bug" }] } },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Unknown label names error with a lookup hint, in both directions.
await snapshotTest({
  name: "Issue Update Command - Unknown Add Label",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--add-label", "nosuch"],
  canFail: true,
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "nosuch", teamKey: "ENG" },
          response: { data: { issueLabels: { nodes: [] } } },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

await snapshotTest({
  name: "Issue Update Command - Unknown Remove Label",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--remove-label", "nosuch"],
  canFail: true,
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetIssueLabelIdByNameForTeam",
          variables: { name: "nosuch", teamKey: "ENG" },
          response: { data: { issueLabels: { nodes: [] } } },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// An unknown --state must surface the valid options and point at
// `linear team states`, not just "not found".
await snapshotTest({
  name: "Issue Update Command - Unknown State Lists Valid States",
  meta: import.meta,
  colors: false,
  args: ["ENG-123", "--state", "Nope"],
  canFail: true,
  async fn() {
    const { cleanup } = await setupMockLinearServer(
      [
        {
          queryName: "GetTeamIdByKey",
          variables: { team: "ENG" },
          response: { data: { teams: { nodes: [{ id: "team-eng-id" }] } } },
        },
        {
          queryName: "GetWorkflowStates",
          variables: { teamKey: "ENG" },
          response: {
            data: {
              team: {
                states: {
                  nodes: [
                    { id: "s-todo", name: "Todo", type: "unstarted", position: 1 },
                    { id: "s-progress", name: "In Progress", type: "started", position: 2 },
                    { id: "s-done", name: "Done", type: "completed", position: 3 },
                  ],
                },
              },
            },
          },
        },
      ],
      { LINEAR_TEAM_ID: "ENG" },
    )

    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})
