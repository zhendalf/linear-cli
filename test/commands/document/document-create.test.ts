import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { createCommand } from "../../../src/commands/document/document-create.ts"
import { MockLinearServer } from "../../utils/mock_linear_server.ts"

// Test help output
await snapshotTest({
  name: "Document Create Command - Help Text",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await createCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Test creating a document with inline content
await snapshotTest({
  name: "Document Create Command - With Inline Content",
  meta: import.meta,
  colors: false,
  args: ["--title", "Test Document", "--content", "# Hello\n\nWorld"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "CreateDocument",
        variables: {
          input: {
            title: "Test Document",
            content: "# Hello\n\nWorld",
          },
        },
        response: {
          data: {
            documentCreate: {
              success: true,
              document: {
                id: "doc-new",
                slugId: "newd0c12345",
                title: "Test Document",
                url:
                  "https://linear.app/test/document/test-document-newd0c12345",
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

// Test creating a document attached to a project
await snapshotTest({
  name: "Document Create Command - Attached To Project",
  meta: import.meta,
  colors: false,
  args: [
    "--title",
    "Project Spec",
    "--project",
    "tinycloud-sdk",
    "--content",
    "# Spec",
  ],
  async fn() {
    const server = new MockLinearServer([
      // Mock project resolution query
      {
        queryName: "GetProjectForDocument",
        variables: { slugId: "tinycloud-sdk" },
        response: {
          data: {
            project: {
              id: "project-uuid-123",
              name: "TinyCloud SDK",
            },
          },
        },
      },
      // Mock document create mutation
      {
        queryName: "CreateDocument",
        response: {
          data: {
            documentCreate: {
              success: true,
              document: {
                id: "doc-proj",
                slugId: "projd0c456",
                title: "Project Spec",
                url: "https://linear.app/test/document/project-spec-projd0c456",
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

// Test creating a document attached to an issue
await snapshotTest({
  name: "Document Create Command - Attached To Issue",
  meta: import.meta,
  colors: false,
  args: [
    "--title",
    "Investigation",
    "--issue",
    "TC-123",
    "--content",
    "# Notes",
  ],
  async fn() {
    const server = new MockLinearServer([
      // Mock issue resolution query
      {
        queryName: "GetIssueForDocument",
        variables: { id: "TC-123" },
        response: {
          data: {
            issue: {
              id: "issue-uuid-456",
              identifier: "TC-123",
            },
          },
        },
      },
      // Mock document create mutation
      {
        queryName: "CreateDocument",
        response: {
          data: {
            documentCreate: {
              success: true,
              document: {
                id: "doc-issue",
                slugId: "issued0c789",
                title: "Investigation",
                url:
                  "https://linear.app/test/document/investigation-issued0c789",
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

// Test creating a document with icon
await snapshotTest({
  name: "Document Create Command - With Icon",
  meta: import.meta,
  colors: false,
  args: ["--title", "Design Doc", "--icon", "📐", "--content", "# Design"],
  async fn() {
    const server = new MockLinearServer([
      {
        queryName: "CreateDocument",
        variables: {
          input: {
            title: "Design Doc",
            content: "# Design",
            icon: "📐",
          },
        },
        response: {
          data: {
            documentCreate: {
              success: true,
              document: {
                id: "doc-icon",
                slugId: "icond0c000",
                title: "Design Doc",
                url: "https://linear.app/test/document/design-doc-icond0c000",
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

// Test missing title error
await snapshotTest({
  name: "Document Create Command - Missing Title Error",
  meta: import.meta,
  colors: false,
  canFail: true,
  args: ["--content", "# Content without title"],
  async fn() {
    // Set dummy API key so validation logic is reached (not "api_key not set" error)
    process.env["LINEAR_API_KEY"] = "dummy-key-for-validation-test"
    try {
      await createCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      delete process.env["LINEAR_API_KEY"]
    }
  },
})

// NOTE: "API Error" test removed - stack traces contain machine-specific paths
