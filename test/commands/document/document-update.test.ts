import { updateCommand } from "../../../src/commands/document/document-update.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Document Update Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test updating document title
await snapshotTest({
  name: "Document Update Command - Update Title",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--title", "New Title"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: {
            title: "New Title",
          },
        },
        response: {
          data: {
            documentUpdate: {
              success: true,
              document: {
                id: "doc-1",
                slugId: "d4b93e3b2695",
                title: "New Title",
                url: "https://linear.app/test/document/new-title-d4b93e3b2695",
                updatedAt: "2026-01-19T10:00:00Z",
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

// Test updating document content
await snapshotTest({
  name: "Document Update Command - Update Content",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--content", "# Updated Content\n\nNew content here."],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DocumentInlineCommentGuard",
        variables: { id: "d4b93e3b2695", after: null },
        response: {
          data: {
            document: {
              id: "doc-1",
              comments: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      },
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: {
            content: "# Updated Content\n\nNew content here.",
          },
        },
        response: {
          data: {
            documentUpdate: {
              success: true,
              document: {
                id: "doc-1",
                slugId: "d4b93e3b2695",
                title: "Delegation System Spec",
                url: "https://linear.app/test/document/delegation-system-spec-d4b93e3b2695",
                updatedAt: "2026-01-19T10:00:00Z",
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

// Test updating multiple fields
await snapshotTest({
  name: "Document Update Command - Update Multiple Fields",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--title", "Updated Title", "--content", "# New Content", "--icon", "📝"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DocumentInlineCommentGuard",
        variables: { id: "d4b93e3b2695", after: null },
        response: {
          data: {
            document: {
              id: "doc-1",
              comments: {
                nodes: [],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      },
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: {
            title: "Updated Title",
            content: "# New Content",
            icon: "📝",
          },
        },
        response: {
          data: {
            documentUpdate: {
              success: true,
              document: {
                id: "doc-1",
                slugId: "d4b93e3b2695",
                title: "Updated Title",
                url: "https://linear.app/test/document/updated-title-d4b93e3b2695",
                updatedAt: "2026-01-19T10:00:00Z",
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

// NOTE: "Document Not Found" test removed - stack traces contain machine-specific paths

// Test no update fields provided
await snapshotTest({
  name: "Document Update Command - No Fields Provided",
  meta: import.meta,
  colors: false,
  canFail: true,
  args: ["d4b93e3b2695"],
  async fn() {
    // Set dummy API key so validation logic is reached (not "api_key not set" error)
    process.env["LINEAR_API_KEY"] = "dummy-key-for-validation-test"
    try {
      await updateCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// NOTE: "Permission Error" test removed - stack traces contain machine-specific paths

// Test content updates allow top-level document comments without inline anchors
await snapshotTest({
  name: "Document Update Command - Allows Content Update With Top Level Comments",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--content", "# Updated Content"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DocumentInlineCommentGuard",
        variables: { id: "d4b93e3b2695", after: null },
        response: {
          data: {
            document: {
              id: "doc-1",
              comments: {
                nodes: [
                  {
                    id: "comment-1",
                    quotedText: null,
                    resolvedAt: null,
                    archivedAt: null,
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      },
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: { content: "# Updated Content" },
        },
        response: {
          data: {
            documentUpdate: {
              success: true,
              document: {
                id: "doc-1",
                slugId: "d4b93e3b2695",
                title: "Delegation System Spec",
                url: "https://linear.app/test/document/delegation-system-spec-d4b93e3b2695",
                updatedAt: "2026-01-19T10:00:00Z",
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

// Test content updates refuse to run when active inline document comments exist.
// The guard pages through the comments connection: the first page holds only a
// top-level comment, the inline anchor is on the second page.
await snapshotTest({
  name: "Document Update Command - Blocks Content Update With Inline Comments",
  meta: import.meta,
  colors: false,
  canFail: true,
  args: ["d4b93e3b2695", "--content", "# Updated Content"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DocumentInlineCommentGuard",
        variables: { id: "d4b93e3b2695", after: null },
        response: {
          data: {
            document: {
              id: "doc-1",
              comments: {
                nodes: [
                  {
                    id: "comment-1",
                    quotedText: null,
                    resolvedAt: null,
                    archivedAt: null,
                  },
                ],
                pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
              },
            },
          },
        },
      },
      {
        queryName: "DocumentInlineCommentGuard",
        variables: { id: "d4b93e3b2695", after: "cursor-1" },
        response: {
          data: {
            document: {
              id: "doc-1",
              comments: {
                nodes: [
                  {
                    id: "comment-2",
                    quotedText: "Current Content",
                    resolvedAt: null,
                    archivedAt: null,
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
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

// Test --force bypasses the comment guard for intentional content replacement:
// no DocumentInlineCommentGuard mock is configured, so any guard request would
// fail the test.
await snapshotTest({
  name: "Document Update Command - Force Content Update With Comments",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--content", "# Updated Content", "--force"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: { content: "# Updated Content" },
        },
        response: {
          data: {
            documentUpdate: {
              success: true,
              document: {
                id: "doc-1",
                slugId: "d4b93e3b2695",
                title: "Delegation System Spec",
                url: "https://linear.app/test/document/delegation-system-spec-d4b93e3b2695",
                updatedAt: "2026-01-19T10:00:00Z",
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

// A RESOLVED inline comment (closed thread) must NOT block a content update:
// detaching the anchor of a resolved comment loses no live context, so the
// guard should let the update through without --force.
await snapshotTest({
  name: "Document Update Command - Resolved Inline Comment Does Not Block",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--content", "# Updated Content"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "DocumentInlineCommentGuard",
        variables: { id: "d4b93e3b2695", after: null },
        response: {
          data: {
            document: {
              id: "doc-1",
              comments: {
                nodes: [
                  {
                    // Inline (has quotedText) but resolved: must be ignored.
                    id: "comment-resolved",
                    quotedText: "Old anchored text",
                    resolvedAt: "2026-01-15T10:00:00Z",
                    archivedAt: null,
                  },
                ],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      },
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: { content: "# Updated Content" },
        },
        response: {
          data: {
            documentUpdate: {
              success: true,
              document: {
                id: "doc-1",
                slugId: "d4b93e3b2695",
                title: "Delegation System Spec",
                url: "https://linear.app/test/document/delegation-system-spec-d4b93e3b2695",
                updatedAt: "2026-01-19T10:00:00Z",
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

// Regression tests for --project: `document update` can re-point the
// document's related project (previously only settable at create time).

const projectDocResponse = {
  data: {
    documentUpdate: {
      success: true,
      document: {
        id: "doc-1",
        slugId: "d4b93e3b2695",
        title: "Spec",
        url: "https://linear.app/test/document/spec-d4b93e3b2695",
        updatedAt: "2026-01-19T10:00:00Z",
      },
    },
  },
}

// Set the project by UUID — resolveProjectId short-circuits, so the only query
// is the update mutation carrying the resolved projectId. No content is being
// written, so no inline-comment guard query runs either.
await snapshotTest({
  name: "Document Update Command - Set Project By UUID",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--project", "00000000-0000-0000-0000-000000000000"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: { projectId: "00000000-0000-0000-0000-000000000000" },
        },
        response: projectDocResponse,
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

// Set the project by slug ID — resolveProjectId looks it up, then the update runs.
await snapshotTest({
  name: "Document Update Command - Set Project By Slug",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--project", "tech-debt-abc123def456"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetProjectBySlug",
        variables: { slugId: "tech-debt-abc123def456" },
        response: {
          data: {
            projects: { nodes: [{ id: "proj-uuid", slugId: "tech-debt-abc123def456" }] },
          },
        },
      },
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: { projectId: "proj-uuid" },
        },
        response: projectDocResponse,
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

// Set the project by name — the slug lookup misses, then the exact-name lookup
// resolves it, then the update runs.
await snapshotTest({
  name: "Document Update Command - Set Project By Name",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--project", "Tech Debt"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetProjectBySlug",
        variables: { slugId: "Tech Debt" },
        response: { data: { projects: { nodes: [] } } },
      },
      {
        queryName: "GetProjectIdByName",
        variables: { name: "Tech Debt" },
        response: { data: { projects: { nodes: [{ id: "proj-uuid" }] } } },
      },
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: { projectId: "proj-uuid" },
        },
        response: projectDocResponse,
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

// Combining a project change with another field updates both in one mutation.
await snapshotTest({
  name: "Document Update Command - Title And Project",
  meta: import.meta,
  colors: false,
  args: [
    "d4b93e3b2695",
    "--title",
    "Renamed Spec",
    "--project",
    "00000000-0000-0000-0000-000000000000",
  ],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "UpdateDocument",
        variables: {
          id: "d4b93e3b2695",
          input: {
            title: "Renamed Spec",
            projectId: "00000000-0000-0000-0000-000000000000",
          },
        },
        response: projectDocResponse,
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

// An unknown project fails with the standard not-found error and no update.
await snapshotTest({
  name: "Document Update Command - Project Not Found",
  meta: import.meta,
  colors: false,
  canFail: true,
  args: ["d4b93e3b2695", "--project", "Nope"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetProjectBySlug",
        variables: { slugId: "Nope" },
        response: { data: { projects: { nodes: [] } } },
      },
      {
        queryName: "GetProjectIdByName",
        variables: { name: "Nope" },
        response: { data: { projects: { nodes: [] } } },
      },
      {
        queryName: "GetProjectIdBySlugId",
        variables: { slugId: "Nope" },
        response: { data: { projects: { nodes: [] } } },
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
