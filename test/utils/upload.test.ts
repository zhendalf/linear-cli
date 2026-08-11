import { describe, expect, test } from "bun:test"
import { ValidationError } from "../../src/utils/errors.ts"
import { formatAsMarkdownLink, resolveMakePublic } from "../../src/utils/upload.ts"

describe("resolveMakePublic", () => {
  test("defaults to private when not requested", () => {
    expect(resolveMakePublic("image/png")).toBe(false)
    expect(resolveMakePublic("image/png", undefined)).toBe(false)
  })

  test("defaults to private for non-image types", () => {
    expect(resolveMakePublic("application/pdf")).toBe(false)
  })

  test("allows public for raster images when requested", () => {
    for (const type of [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/tiff",
    ]) {
      expect(resolveMakePublic(type, true)).toBe(true)
    }
  })

  test("explicit false stays private even for images", () => {
    expect(resolveMakePublic("image/png", false)).toBe(false)
  })

  test("rejects public for non-public-capable types", () => {
    // SVG is an image but not allowed to be public by Linear
    expect(() => resolveMakePublic("image/svg+xml", true)).toThrow(ValidationError)
    expect(() => resolveMakePublic("application/pdf", true)).toThrow(ValidationError)
    expect(() => resolveMakePublic("application/octet-stream", true)).toThrow(ValidationError)
  })
})

describe("formatAsMarkdownLink", () => {
  test("uses image syntax for images and link syntax otherwise", () => {
    expect(
      formatAsMarkdownLink({
        filename: "shot.png",
        assetUrl: "https://uploads.linear.app/fake/shot.png",
        contentType: "image/png",
      }),
    ).toBe("![shot.png](https://uploads.linear.app/fake/shot.png)")
    expect(
      formatAsMarkdownLink({
        filename: "server.log",
        assetUrl: "https://uploads.linear.app/fake/server.log",
        contentType: "application/octet-stream",
      }),
    ).toBe("[server.log](https://uploads.linear.app/fake/server.log)")
  })
})
