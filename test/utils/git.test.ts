import { expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { getCurrentBranch, getRepoDir, isInsideGitRepo } from "../../src/utils/git.ts"

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
    const commitHash = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tempDir })
      .toString()
      .trim()

    // Checkout the commit to create detached HEAD
    execFileSync("git", ["checkout", commitHash], { cwd: tempDir, stdio: "pipe" })

    const branch = await getCurrentBranch()
    expect(branch).toBeNull()
  } finally {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("isInsideGitRepo - false in a non-repository directory", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-git-test-"))
  const originalCwd = process.cwd()

  try {
    process.chdir(tempDir)
    expect(await isInsideGitRepo()).toBe(false)
  } finally {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("isInsideGitRepo - true inside a repository, including nested directories", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-git-test-"))
  const originalCwd = process.cwd()

  try {
    process.chdir(tempDir)
    execFileSync("git", ["init"], { cwd: tempDir, stdio: "pipe" })
    expect(await isInsideGitRepo()).toBe(true)

    const nested = join(tempDir, "nested", "dir")
    await mkdir(nested, { recursive: true })
    process.chdir(nested)
    expect(await isInsideGitRepo()).toBe(true)
  } finally {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  }
})

// git prints "false" with exit status 0 from inside the .git directory itself,
// so the helper must read stdout rather than trusting the exit code.
test("isInsideGitRepo - false inside the .git directory", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-git-test-"))
  const originalCwd = process.cwd()

  try {
    execFileSync("git", ["init"], { cwd: tempDir, stdio: "pipe" })
    process.chdir(join(tempDir, ".git"))
    expect(await isInsideGitRepo()).toBe(false)
  } finally {
    process.chdir(originalCwd)
    await rm(tempDir, { recursive: true, force: true })
  }
})
