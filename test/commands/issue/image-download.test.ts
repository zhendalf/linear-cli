import { expect, test } from "bun:test"
import {
  extractImageInfo,
  extractLinearLinkInfo,
  getUrlHash,
  replaceImageUrls,
} from "../../../src/utils/markdown-images.ts"
import {
  formatPathHyperlink,
  hyperlink,
  resolveHyperlinkFormat,
  shouldEnableHyperlinks,
} from "../../../src/utils/hyperlink.ts"

test("extractImageInfo - extracts markdown images", () => {
  const markdown = "Check this ![screenshot](https://example.com/img.png)"
  const images = extractImageInfo(markdown)
  expect(images).toEqual([{
    url: "https://example.com/img.png",
    alt: "screenshot",
  }])
})

test("extractImageInfo - extracts multiple images", () => {
  const markdown = `
Here is ![first](https://example.com/1.png) and ![second](https://example.com/2.png)
`
  const images = extractImageInfo(markdown)
  expect(images.length).toBe(2)
  expect(images[0]).toEqual({ url: "https://example.com/1.png", alt: "first" })
  expect(images[1]).toEqual({ url: "https://example.com/2.png", alt: "second" })
})

test("extractImageInfo - handles image without alt text", () => {
  const markdown = "![](https://example.com/img.png)"
  const images = extractImageInfo(markdown)
  expect(images).toEqual([{
    url: "https://example.com/img.png",
    alt: null,
  }])
})

test("extractImageInfo - handles empty content", () => {
  expect(extractImageInfo(null)).toEqual([])
  expect(extractImageInfo(undefined)).toEqual([])
  expect(extractImageInfo("")).toEqual([])
})

test("extractImageInfo - handles markdown with no images", () => {
  const markdown = "# Hello\n\nThis is just text with no images."
  const images = extractImageInfo(markdown)
  expect(images).toEqual([])
})

test("getUrlHash - generates consistent hash", async () => {
  const hash1 = await getUrlHash("https://example.com/img.png")
  const hash2 = await getUrlHash("https://example.com/img.png")
  expect(hash1).toBe(hash2)
  expect(hash1.length).toBe(16)
})

test("getUrlHash - different URLs produce different hashes", async () => {
  const hash1 = await getUrlHash("https://example.com/img1.png")
  const hash2 = await getUrlHash("https://example.com/img2.png")
  expect(hash1 !== hash2).toBe(true)
})

test("getUrlHash - hash is valid hex string", async () => {
  const hash = await getUrlHash("https://example.com/img.png")
  expect(/^[0-9a-f]{16}$/.test(hash)).toBe(true)
})

test("replaceImageUrls - replaces URLs with local paths", async () => {
  const markdown = "![alt](https://example.com/img.png)"
  const urlToPath = new Map([
    ["https://example.com/img.png", "/tmp/cached/img.png"],
  ])
  const result = await replaceImageUrls(markdown, urlToPath)
  expect(result.includes("/tmp/cached/img.png")).toBe(true)
  expect(result.includes("https://example.com/img.png")).toBe(false)
})

test("replaceImageUrls - replaces multiple URLs", async () => {
  const markdown = `
![first](https://example.com/1.png)
![second](https://example.com/2.png)
`
  const urlToPath = new Map([
    ["https://example.com/1.png", "/tmp/cached/1.png"],
    ["https://example.com/2.png", "/tmp/cached/2.png"],
  ])
  const result = await replaceImageUrls(markdown, urlToPath)
  expect(result.includes("/tmp/cached/1.png")).toBe(true)
  expect(result.includes("/tmp/cached/2.png")).toBe(true)
})

test("replaceImageUrls - leaves unmatched URLs unchanged", async () => {
  const markdown = "![alt](https://example.com/img.png)"
  const urlToPath = new Map([
    ["https://other.com/img.png", "/tmp/cached/img.png"],
  ])
  const result = await replaceImageUrls(markdown, urlToPath)
  expect(result.includes("https://example.com/img.png")).toBe(true)
})

test("replaceImageUrls - preserves GFM task lists", async () => {
  const markdown =
    "- [ ] todo\n- [x] done\n\n![alt](https://example.com/img.png)\n"
  const urlToPath = new Map([
    ["https://example.com/img.png", "/tmp/cached/img.png"],
  ])
  const result = await replaceImageUrls(markdown, urlToPath)
  expect(result.includes("- [ ] todo")).toBe(true)
  expect(result.includes("- [x] done")).toBe(true)
  expect(result.includes("/tmp/cached/img.png")).toBe(true)
})

test("replaceImageUrls - preserves GFM tables", async () => {
  const markdown =
    "| a | b |\n| - | - |\n| 1 | 2 |\n\n![alt](https://example.com/img.png)\n"
  const urlToPath = new Map([
    ["https://example.com/img.png", "/tmp/cached/img.png"],
  ])
  const result = await replaceImageUrls(markdown, urlToPath)
  expect(result.includes("| a | b |")).toBe(true)
  expect(result.includes("/tmp/cached/img.png")).toBe(true)
})

test("replaceImageUrls - handles empty map", async () => {
  const markdown = "![alt](https://example.com/img.png)"
  const urlToPath = new Map<string, string>()
  const result = await replaceImageUrls(markdown, urlToPath)
  expect(result.includes("https://example.com/img.png")).toBe(true)
})

test("extractLinearLinkInfo - extracts Linear upload links", () => {
  const md = "See [file](https://uploads.linear.app/abc/doc.pdf)"
  const links = extractLinearLinkInfo(md)
  expect(links.length).toBe(1)
  expect(links[0].url).toBe("https://uploads.linear.app/abc/doc.pdf")
})

test("extractLinearLinkInfo - ignores spoofed domain in path", () => {
  const md = "See [file](https://example.com/uploads.linear.app/doc.pdf)"
  const links = extractLinearLinkInfo(md)
  expect(links.length).toBe(0)
})

test("extractLinearLinkInfo - ignores spoofed subdomain", () => {
  const md = "See [file](https://uploads.linear.app.example.com/doc.pdf)"
  const links = extractLinearLinkInfo(md)
  expect(links.length).toBe(0)
})

// Hyperlink utility tests

test("hyperlink - creates OSC-8 escape sequence", () => {
  const result = hyperlink("click me", "https://example.com")
  expect(result).toBe(
    "\x1b]8;;https://example.com\x1b\\click me\x1b]8;;\x1b\\",
  )
})

test("hyperlink - handles empty text", () => {
  const result = hyperlink("", "https://example.com")
  expect(result).toBe("\x1b]8;;https://example.com\x1b\\\x1b]8;;\x1b\\")
})

test("resolveHyperlinkFormat - resolves default to file URL format", () => {
  expect(resolveHyperlinkFormat("default")).toBe("file://{host}{path}")
})

test("resolveHyperlinkFormat - passes through custom format", () => {
  expect(resolveHyperlinkFormat("custom://{path}")).toBe("custom://{path}")
})

test("formatPathHyperlink - wraps remote URL in hyperlink", () => {
  const result = formatPathHyperlink(
    "https://example.com/img.png",
    "https://example.com/img.png",
    "default",
  )
  // Remote URLs link directly to themselves
  expect(
    result.includes("\x1b]8;;https://example.com/img.png\x1b\\"),
  ).toBe(true)
  expect(
    result.includes("https://example.com/img.png\x1b]8;;\x1b\\"),
  ).toBe(true)
})

test("formatPathHyperlink - wraps local path with file URL format", () => {
  const result = formatPathHyperlink(
    "/tmp/test/image.png",
    "/tmp/test/image.png",
    "default",
  )
  // Local paths get file:// URL format
  expect(result.includes("\x1b]8;;file://")).toBe(true)
  expect(result.includes("/tmp/test/image.png")).toBe(true)
})

test("formatPathHyperlink - encodes special characters in path", () => {
  const result = formatPathHyperlink(
    "/tmp/test/my image#1.png",
    "/tmp/test/my image#1.png",
    "default",
  )
  // # should be percent-encoded
  expect(result.includes("%23")).toBe(true)
  // Spaces should be percent-encoded
  expect(result.includes("%20")).toBe(true)
})

test("shouldEnableHyperlinks - returns false when NO_COLOR is set", () => {
  const originalNoColor = process.env["NO_COLOR"]
  try {
    process.env["NO_COLOR"] = "1"
    expect(shouldEnableHyperlinks()).toBe(false)
  } finally {
    if (originalNoColor === undefined) {
      delete process.env["NO_COLOR"]
    } else {
      process.env["NO_COLOR"] = originalNoColor
    }
  }
})

// formatPathHyperlink already tested above - it creates OSC-8 escape sequences
// The hyperlink application to rendered output happens in issue-view.ts
// and uses formatPathHyperlink internally
