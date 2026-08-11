import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  resolveProjectDescription,
} from "../../../src/commands/project/project-description.ts"
import { NotFoundError, ValidationError } from "../../../src/utils/errors.ts"

async function withTempFile(content: string, fn: (path: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "linear-cli-test-"))
  const path = join(dir, "description.md")
  await writeFile(path, content)
  try {
    await fn(path)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test("resolveProjectDescription - returns undefined when neither flag set", async () => {
  const result = await resolveProjectDescription(undefined, undefined)
  expect(result).toBeUndefined()
})

test("resolveProjectDescription - returns inline description", async () => {
  const result = await resolveProjectDescription("hello", undefined)
  expect(result).toBe("hello")
})

test("resolveProjectDescription - reads file content", async () => {
  await withTempFile("from-file", async (path) => {
    const result = await resolveProjectDescription(undefined, path)
    expect(result).toBe("from-file")
  })
})

test("resolveProjectDescription - rejects passing both flags", async () => {
  await expect(resolveProjectDescription("inline", "/tmp/some.md")).rejects.toThrow(ValidationError)
  await expect(resolveProjectDescription("inline", "/tmp/some.md")).rejects.toThrow(
    "Cannot use --description and --description-file together",
  )
})

test("resolveProjectDescription - rejects inline description over the cap", async () => {
  const tooLong = "x".repeat(PROJECT_DESCRIPTION_MAX_LENGTH + 1)
  await expect(resolveProjectDescription(tooLong, undefined)).rejects.toThrow(ValidationError)
  await expect(resolveProjectDescription(tooLong, undefined)).rejects.toThrow(
    `Project description is ${tooLong.length} characters`,
  )
})

test("resolveProjectDescription - rejects file content over the cap", async () => {
  await withTempFile("y".repeat(PROJECT_DESCRIPTION_MAX_LENGTH + 50), async (path) => {
    await expect(resolveProjectDescription(undefined, path)).rejects.toThrow(
      `exceeds the ${PROJECT_DESCRIPTION_MAX_LENGTH}-character limit`,
    )
  })
})

test("resolveProjectDescription - accepts description exactly at the cap", async () => {
  const exact = "z".repeat(PROJECT_DESCRIPTION_MAX_LENGTH)
  const result = await resolveProjectDescription(exact, undefined)
  expect(result).toBe(exact)
})

test("resolveProjectDescription - throws NotFoundError for missing file", async () => {
  await expect(resolveProjectDescription(undefined, "/tmp/does-not-exist-xyz.md")).rejects.toThrow(
    NotFoundError,
  )
  await expect(resolveProjectDescription(undefined, "/tmp/does-not-exist-xyz.md")).rejects.toThrow(
    "File not found",
  )
})
