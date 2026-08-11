import { expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// The git fixtures in git.test.ts / vcs.test.ts pass `cwd: tempDir`, but an
// inherited GIT_DIR overrides cwd — so `bun test` run straight from a git hook
// used to execute their `git init`/`commit`/`checkout -b` against this
// repository, committing test.txt and creating feature/ABC-123-* branches in
// it. test/setup.ts refuses to run when those variables are present and
// lefthook strips them before invoking bun; these assert the result.

test("test environment carries no repo-redirecting git variables", () => {
  const leaked = [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_QUARANTINE_PATH",
    "GIT_PREFIX",
  ].filter((name) => process.env[name])

  expect(leaked).toEqual([])
})

test("a git fixture in a temp dir is isolated from the surrounding repository", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-git-env-test-"))

  try {
    execFileSync("git", ["init"], { cwd: tempDir, stdio: "pipe" })

    // Resolved from cwd, not from an inherited GIT_DIR: the fixture repo must
    // be the temp dir's own, never this checkout's.
    const gitDir = execFileSync("git", ["rev-parse", "--absolute-git-dir"], {
      cwd: tempDir,
      encoding: "utf8",
    }).trim()

    // macOS hands out /var/... temp paths that git reports as /private/var/...
    expect(gitDir.startsWith(await realpath(tempDir))).toBe(true)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
