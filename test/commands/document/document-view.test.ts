import { viewCommand } from "../../../src/commands/document/document-view.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"

// Test help output
await snapshotTest({
  name: "Document View Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await viewCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test viewing a document
await snapshotTest({
  name: "Document View Command - View Document",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetDocument",
        variables: { id: "d4b93e3b2695" },
        response: {
          data: {
            document: {
              id: "doc-1",
              title: "Delegation System Spec",
              slugId: "d4b93e3b2695",
              content:
                "# Delegation System\n\nThis document describes the delegation system architecture.\n\n## Overview\n\nThe system supports user-to-user delegations with time-bounded capabilities.\n\n## Implementation\n\n- UCAN-based delegation chains\n- PKH DID format for user identity\n- Session key DIDs for signing",
              url: "https://linear.app/test/document/delegation-system-spec-d4b93e3b2695",
              createdAt: "2026-01-15T08:00:00Z",
              updatedAt: "2026-01-18T10:30:00Z",
              creator: { name: "John Doe", email: "john@example.com" },
              project: { name: "TinyCloud SDK", slugId: "tinycloud-sdk" },
              issue: null,
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await viewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test viewing a document with --raw flag
await snapshotTest({
  name: "Document View Command - Raw Output",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--raw"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetDocument",
        variables: { id: "d4b93e3b2695" },
        response: {
          data: {
            document: {
              id: "doc-1",
              title: "Delegation System Spec",
              slugId: "d4b93e3b2695",
              content:
                "# Delegation System\n\nThis document describes the delegation system architecture.",
              url: "https://linear.app/test/document/delegation-system-spec-d4b93e3b2695",
              createdAt: "2026-01-15T08:00:00Z",
              updatedAt: "2026-01-18T10:30:00Z",
              creator: { name: "John Doe", email: "john@example.com" },
              project: { name: "TinyCloud SDK", slugId: "tinycloud-sdk" },
              issue: null,
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await viewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// Test JSON output: fetches the paginated comments connection, loops all
// pages, and prints the concatenated `comments.nodes` with the final pageInfo
// (connection shape preserved).
await snapshotTest({
  name: "Document View Command - JSON Output",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--json"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetDocumentWithComments",
        variables: { id: "d4b93e3b2695", commentsAfter: null },
        response: {
          data: {
            document: {
              id: "doc-1",
              title: "Delegation System Spec",
              slugId: "d4b93e3b2695",
              content:
                "# Delegation System\n\nThis document describes the delegation system architecture.",
              url: "https://linear.app/test/document/delegation-system-spec-d4b93e3b2695",
              createdAt: "2026-01-15T08:00:00Z",
              updatedAt: "2026-01-18T10:30:00Z",
              creator: { name: "John Doe", email: "john@example.com" },
              project: { name: "TinyCloud SDK", slugId: "tinycloud-sdk" },
              issue: null,
              comments: {
                nodes: [
                  {
                    id: "comment-1",
                    body: "Can we clarify this?",
                    quotedText: "delegation system architecture",
                    documentContentId: "document-content-1",
                    createdAt: "2026-01-18T11:00:00Z",
                    updatedAt: "2026-01-18T11:00:00Z",
                    archivedAt: null,
                    resolvedAt: null,
                    url: "https://linear.app/test/comment/comment-1",
                    user: { name: "Jane Reviewer", email: "jane@example.com" },
                    parent: null,
                  },
                ],
                pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
              },
            },
          },
        },
      },
      {
        queryName: "GetDocumentWithComments",
        variables: { id: "d4b93e3b2695", commentsAfter: "cursor-1" },
        response: {
          data: {
            document: {
              id: "doc-1",
              title: "Delegation System Spec",
              slugId: "d4b93e3b2695",
              content:
                "# Delegation System\n\nThis document describes the delegation system architecture.",
              url: "https://linear.app/test/document/delegation-system-spec-d4b93e3b2695",
              createdAt: "2026-01-15T08:00:00Z",
              updatedAt: "2026-01-18T10:30:00Z",
              creator: { name: "John Doe", email: "john@example.com" },
              project: { name: "TinyCloud SDK", slugId: "tinycloud-sdk" },
              issue: null,
              comments: {
                nodes: [
                  {
                    id: "comment-2",
                    body: "Follow-up note",
                    quotedText: null,
                    documentContentId: "document-content-1",
                    createdAt: "2026-01-18T12:00:00Z",
                    updatedAt: "2026-01-18T12:00:00Z",
                    archivedAt: null,
                    resolvedAt: null,
                    url: "https://linear.app/test/comment/comment-2",
                    user: { name: "John Doe", email: "john@example.com" },
                    parent: { id: "comment-1" },
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

      await viewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// With --no-download, image URLs in the markdown are passed through verbatim.
// Without --no-download, the raw output would contain a local /tmp path
// (after fetching from the Linear CDN), so this snapshot exercises the
// wiring that skips the fetch.
await snapshotTest({
  name: "Document View Command - No Download Keeps Remote URLs",
  meta: import.meta,
  colors: false,
  args: ["d4b93e3b2695", "--raw", "--no-download"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetDocument",
        variables: { id: "d4b93e3b2695" },
        response: {
          data: {
            document: {
              id: "doc-1",
              title: "Doc With Image",
              slugId: "d4b93e3b2695",
              content: "# Doc\n\n![screenshot](https://uploads.linear.app/abc/screenshot.png)",
              url: "https://linear.app/test/document/doc-with-image-d4b93e3b2695",
              createdAt: "2026-01-15T08:00:00Z",
              updatedAt: "2026-01-18T10:30:00Z",
              creator: { name: "John Doe", email: "john@example.com" },
              project: null,
              issue: null,
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await viewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// NOTE: "Document Not Found" test removed - stack traces contain machine-specific paths

// Test document attached to issue
await snapshotTest({
  name: "Document View Command - Document Attached To Issue",
  meta: import.meta,
  colors: false,
  args: ["abc123def456"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "GetDocument",
        variables: { id: "abc123def456" },
        response: {
          data: {
            document: {
              id: "doc-3",
              title: "Investigation Notes",
              slugId: "abc123def456",
              content: "# Investigation Notes\n\nNotes from investigating TC-123.",
              url: "https://linear.app/test/document/investigation-notes-abc123def456",
              createdAt: "2026-01-16T08:00:00Z",
              updatedAt: "2026-01-16T09:00:00Z",
              creator: { name: "Alice Dev", email: "alice@example.com" },
              project: null,
              issue: { identifier: "TC-123", title: "Fix login bug" },
            },
          },
        },
      },
    ])

    try {
      await server.start()
      process.env["LINEAR_GRAPHQL_ENDPOINT"] = server.getEndpoint()
      process.env["LINEAR_API_KEY"] = "Bearer test-token"

      await viewCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await server.stop()
      delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      delete process.env["LINEAR_API_KEY"]
    }
  },
})
