import { mkdir, rm, writeFile } from "node:fs/promises"
import { commentAddCommand } from "../../../src/commands/issue/issue-comment-add.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

// Test adding a comment with body flag
await snapshotTest({
  name: "Issue Comment Add Command - With Body Flag",
  meta: import.meta,
  colors: false,
  args: ["TEST-123", "--body", "This is a test comment"],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetIssueId",
        variables: { id: "TEST-123" },
        response: {
          data: {
            issue: {
              id: "issue-uuid-123",
            },
          },
        },
      },
      {
        queryName: "AddComment",
        response: {
          data: {
            commentCreate: {
              success: true,
              comment: {
                id: "comment-uuid-456",
                body: "This is a test comment",
                createdAt: "2024-01-15T10:30:00Z",
                url: "https://linear.app/issue/TEST-123#comment-uuid-456",
                user: {
                  name: "testuser",
                  displayName: "Test User",
                },
              },
            },
          },
        },
      },
    ])

    try {
      await commentAddCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Test replying to a comment with parent flag
await snapshotTest({
  name: "Issue Comment Add Command - With Parent Flag",
  meta: import.meta,
  colors: false,
  args: [
    "TEST-123",
    "--body",
    "This is a reply to the comment",
    "--parent",
    "parent-comment-uuid-123",
  ],
  async fn() {
    const { cleanup } = await setupMockLinearServer([
      {
        queryName: "GetIssueId",
        variables: { id: "TEST-123" },
        response: {
          data: {
            issue: {
              id: "issue-uuid-123",
            },
          },
        },
      },
      {
        queryName: "AddComment",
        response: {
          data: {
            commentCreate: {
              success: true,
              comment: {
                id: "comment-uuid-reply-789",
                body: "This is a reply to the comment",
                createdAt: "2024-01-15T11:45:00Z",
                url: "https://linear.app/issue/TEST-123#comment-uuid-reply-789",
                user: {
                  name: "testuser",
                  displayName: "Test User",
                },
              },
            },
          },
        },
      },
    ])

    try {
      await commentAddCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
    }
  },
})

// Validation: --public with no attachments is rejected before any work
await snapshotTest({
  name: "Issue Comment Add Command - Rejects Public Without Attach",
  meta: import.meta,
  colors: false,
  args: ["TEST-123", "--body", "hi", "--public"],
  async fn() {
    await commentAddCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})

// Validation: with --public, an unsupported file anywhere in the batch is
// rejected before ANY attachment uploads — an earlier valid image must not be
// published first. The mock server has no FileUpload handler, so if the image
// were uploaded the failure would be an upload error ("Failed to get upload
// URL"), not this validation error. Seeing the validation error (and no
// "✓ Uploaded" line on stdout) proves the whole batch was rejected up front,
// before any network call.
await snapshotTest({
  name: "Issue Comment Add Command - Rejects Public Batch Before Uploading Earlier Valid Images",
  meta: import.meta,
  colors: false,
  args: [
    "TEST-123",
    "--attach",
    "/tmp/linear-cli-test-comment-add/screenshot.png", // valid raster image, listed first
    "--attach",
    "/tmp/linear-cli-test-comment-add/notes.txt", // unsupported for --public, listed second
    "--public",
  ],
  async fn() {
    const dir = "/tmp/linear-cli-test-comment-add"
    await mkdir(dir, { recursive: true })
    await writeFile(`${dir}/screenshot.png`, "pretend png")
    await writeFile(`${dir}/notes.txt`, "not an image")

    // No FileUpload handler: any actual upload attempt errors instead of
    // hitting real Linear, and produces a different message than the
    // validation error.
    const { cleanup } = await setupMockLinearServer([])

    try {
      await commentAddCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      await cleanup()
      await rm(dir, { recursive: true, force: true })
    }
  },
})

// Help output locks the inline-image guidance in the descriptions
await snapshotTest({
  name: "Issue Comment Add Command - Help",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await commentAddCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})
