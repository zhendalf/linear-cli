import { expect } from "bun:test"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { attachCommand } from "../../../src/commands/issue/issue-attach.ts"
import type { MockLinearServer } from "../../utils/mock_linear_server.ts"
import { snapshotTest } from "../../utils/snapshot_with_fake_time.ts"
import { setupMockLinearServer } from "../../utils/test-helpers.ts"

const TEST_DIR = "/tmp/linear-cli-test-attach"

// A valid 1x1 PNG so getMimeType sees a real image extension and the PUT
// body assertion has known bytes.
const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

interface CapturedUpload {
  contentType: string | null
  headers: Record<string, string>
  body: Uint8Array
}

/**
 * Tiny local server standing in for the signed upload URL (the PUT step of the
 * fileUpload flow). Records every PUT it receives.
 */
function startUploadServer(): {
  url: string
  requests: CapturedUpload[]
  stop: () => void
} {
  const requests: CapturedUpload[] = []
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      if (req.method === "PUT") {
        const headers: Record<string, string> = {}
        req.headers.forEach((value, key) => {
          headers[key] = value
        })
        requests.push({
          contentType: req.headers.get("content-type"),
          headers,
          body: new Uint8Array(await req.arrayBuffer()),
        })
        return new Response(null, { status: 200 })
      }
      return new Response("Not Found", { status: 404 })
    },
  })
  return {
    url: `http://127.0.0.1:${server.port}/upload`,
    requests,
    stop: () => server.stop(true),
  }
}

function mockAttachFlow(
  server: MockLinearServer,
  options: { assetUrl: string; uploadUrl: string },
): void {
  server.addResponse({
    queryName: "FileUpload",
    response: {
      data: {
        fileUpload: {
          success: true,
          uploadFile: {
            assetUrl: options.assetUrl,
            uploadUrl: options.uploadUrl,
            headers: [{ key: "x-goog-content-length-range", value: "0,10485760" }],
          },
        },
      },
    },
  })
  server.addResponse({
    queryName: "AttachmentCreate",
    response: {
      data: {
        attachmentCreate: {
          success: true,
          attachment: {
            id: "attachment-uuid-1",
            url: options.assetUrl,
            title: options.assetUrl.split("/").at(-1),
          },
        },
      },
    },
  })
}

const GET_ISSUE_ID_RESPONSE = {
  queryName: "GetIssueId",
  variables: { id: "TEST-123" },
  response: { data: { issue: { id: "issue-uuid-123" } } },
}

// Image attachment: sidebar wording plus the inline-display hint
await snapshotTest({
  name: "Issue Attach Command - Image Prints Inline Hint",
  meta: import.meta,
  colors: false,
  args: ["TEST-123", `${TEST_DIR}/screenshot.png`],
  async fn() {
    await mkdir(TEST_DIR, { recursive: true })
    await writeFile(`${TEST_DIR}/screenshot.png`, PNG_BYTES)
    const uploads = startUploadServer()
    const { server, cleanup } = await setupMockLinearServer([GET_ISSUE_ID_RESPONSE])
    mockAttachFlow(server, {
      assetUrl: "https://uploads.linear.app/fake/screenshot.png",
      uploadUrl: uploads.url,
    })

    try {
      await attachCommand.parseAsync(process.argv.slice(2), { from: "user" })
      expect(uploads.requests.length).toBe(1)
      expect(uploads.requests[0]?.contentType).toBe("image/png")
      expect(uploads.requests[0]?.body).toEqual(PNG_BYTES)
      expect(uploads.requests[0]?.headers["x-goog-content-length-range"]).toBe("0,10485760")
    } finally {
      uploads.stop()
      await cleanup()
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  },
})

// A path with a space and a quote must be shell-quoted in the hint
await snapshotTest({
  name: "Issue Attach Command - Hint Shell-Quotes Unusual Paths",
  meta: import.meta,
  colors: false,
  args: ["TEST-123", `${TEST_DIR}/it's a shot.png`],
  async fn() {
    await mkdir(TEST_DIR, { recursive: true })
    await writeFile(`${TEST_DIR}/it's a shot.png`, PNG_BYTES)
    const uploads = startUploadServer()
    const { server, cleanup } = await setupMockLinearServer([GET_ISSUE_ID_RESPONSE])
    mockAttachFlow(server, {
      assetUrl: "https://uploads.linear.app/fake/shot.png",
      uploadUrl: uploads.url,
    })

    try {
      await attachCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      uploads.stop()
      await cleanup()
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  },
})

// Public image: warning on stderr, and the hint preserves --public
await snapshotTest({
  name: "Issue Attach Command - Public Image Hint Preserves Public Flag",
  meta: import.meta,
  colors: false,
  args: ["TEST-123", `${TEST_DIR}/screenshot.png`, "--public"],
  async fn() {
    await mkdir(TEST_DIR, { recursive: true })
    await writeFile(`${TEST_DIR}/screenshot.png`, PNG_BYTES)
    const uploads = startUploadServer()
    const { server, cleanup } = await setupMockLinearServer([GET_ISSUE_ID_RESPONSE])
    mockAttachFlow(server, {
      assetUrl: "https://uploads.linear.app/fake/screenshot.png",
      uploadUrl: uploads.url,
    })

    try {
      await attachCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      uploads.stop()
      await cleanup()
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  },
})

// --public with a non-image errors before anything is uploaded
await snapshotTest({
  name: "Issue Attach Command - Public Non-Image Rejected Before Upload",
  meta: import.meta,
  colors: false,
  args: ["TEST-123", `${TEST_DIR}/server.log`, "--public"],
  async fn() {
    await mkdir(TEST_DIR, { recursive: true })
    await writeFile(`${TEST_DIR}/server.log`, "2026-07-20T14:02:11Z INFO server listening\n")
    const uploads = startUploadServer()
    const { server, cleanup } = await setupMockLinearServer([GET_ISSUE_ID_RESPONSE])
    mockAttachFlow(server, {
      assetUrl: "https://uploads.linear.app/fake/server.log",
      uploadUrl: uploads.url,
    })

    try {
      // handleError exits via the harness's mocked process.exit, which throws;
      // swallow that control-flow signal so the no-upload assertion still runs.
      try {
        await attachCommand.parseAsync(process.argv.slice(2), { from: "user" })
      } catch (error) {
        if (!(error instanceof Error) || error.name !== "ProcessExitSignal") throw error
      }
      expect(uploads.requests.length).toBe(0)
    } finally {
      uploads.stop()
      await cleanup()
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  },
})

// Non-image attachment: sidebar wording, no inline hint
await snapshotTest({
  name: "Issue Attach Command - Non-Image Has No Hint",
  meta: import.meta,
  colors: false,
  args: ["TEST-123", `${TEST_DIR}/server.log`],
  async fn() {
    await mkdir(TEST_DIR, { recursive: true })
    await writeFile(`${TEST_DIR}/server.log`, "2026-07-20T14:02:11Z INFO server listening\n")
    const uploads = startUploadServer()
    const { server, cleanup } = await setupMockLinearServer([GET_ISSUE_ID_RESPONSE])
    mockAttachFlow(server, {
      assetUrl: "https://uploads.linear.app/fake/server.log",
      uploadUrl: uploads.url,
    })

    try {
      await attachCommand.parseAsync(process.argv.slice(2), { from: "user" })
    } finally {
      uploads.stop()
      await cleanup()
      await rm(TEST_DIR, { recursive: true, force: true })
    }
  },
})

// Help output locks the sidebar-attachment description
await snapshotTest({
  name: "Issue Attach Command - Help",
  meta: import.meta,
  colors: false,
  args: ["--help"],
  async fn() {
    await attachCommand.parseAsync(process.argv.slice(2), { from: "user" })
  },
})
