import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { getCurrentBranch, getRepoDir } from "../../src/utils/git.ts"
import { CliError } from "../../src/utils/errors.ts"

test("getCurrentBranch - handles errors when not in a git repository", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-git-test-"))
  const originalCwd = process.cwd()

  try {
    process.chdir(tempDir)
    await expect(getCurrentBranch()).rejects.toThrow("Failed to get current branch")
  } finally {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("getRepoDir - handles errors when not in a git repository", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-git-test-"))
  const originalCwd = process.cwd()

  try {
    process.chdir(tempDir)
    await expect(getRepoDir()).rejects.toThrow("Failed to get repository directory")
  } finally {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("getCurrentBranch - returns null for detached HEAD", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-git-test-"))
  const originalCwd = process.cwd()

  try {
    process.chdir(tempDir)

    execFileSync("git", ["init"], { cwd: tempDir })
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: tempDir })
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: tempDir })

    await writeFile(join(tempDir, "test.txt"), "test")
    execFileSync("git", ["add", "test.txt"], { cwd: tempDir })
    execFileSync("git", ["commit", "-m", "initial commit"], { cwd: tempDir })

    // Get the commit hash
    const commitHash = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tempDir }).toString().trim()

    // Checkout the commit to create detached HEAD
    execFileSync("git", ["checkout", commitHash], { cwd: tempDir, stdio: "pipe" })

    const branch = await getCurrentBranch()
    expect(branch).toBeNull()
  } finally {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  }
})
