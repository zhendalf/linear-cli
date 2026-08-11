import { expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { getCurrentIssueFromVcs, startVcsWork } from "../../src/utils/vcs.ts"

test("getCurrentIssueFromVcs - handles git errors gracefully", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-vcs-test-"))
  const originalCwd = process.cwd()
  const originalVcs = process.env["LINEAR_VCS"]

  try {
    process.env["LINEAR_VCS"] = "git"
    process.chdir(tempDir)
    await expect(getCurrentIssueFromVcs()).rejects.toThrow("Failed to get current branch")
  } finally {
    process.chdir(originalCwd)
    if (originalVcs !== undefined) {
      process.env["LINEAR_VCS"] = originalVcs
    } else {
      delete process.env["LINEAR_VCS"]
    }
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("getCurrentIssueFromVcs - extracts issue ID from git branch", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-vcs-test-"))
  const originalCwd = process.cwd()
  const originalVcs = process.env["LINEAR_VCS"]

  try {
    process.env["LINEAR_VCS"] = "git"
    process.chdir(tempDir)

    execFileSync("git", ["init"], { cwd: tempDir })
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: tempDir })
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: tempDir })

    await writeFile(join(tempDir, "test.txt"), "test")
    execFileSync("git", ["add", "test.txt"], { cwd: tempDir })
    execFileSync("git", ["commit", "-m", "initial commit"], { cwd: tempDir })

    execFileSync("git", ["checkout", "-b", "feature/ABC-123-test-feature"], { cwd: tempDir })

    const issueId = await getCurrentIssueFromVcs()
    expect(issueId).toBe("ABC-123")
  } finally {
    process.chdir(originalCwd)
    if (originalVcs !== undefined) {
      process.env["LINEAR_VCS"] = originalVcs
    } else {
      delete process.env["LINEAR_VCS"]
    }
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("getCurrentIssueFromVcs - returns null for branch without issue ID", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-vcs-test-"))
  const originalCwd = process.cwd()
  const originalVcs = process.env["LINEAR_VCS"]

  try {
    process.env["LINEAR_VCS"] = "git"
    process.chdir(tempDir)

    execFileSync("git", ["init"], { cwd: tempDir })
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: tempDir })
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: tempDir })

    await writeFile(join(tempDir, "test.txt"), "test")
    execFileSync("git", ["add", "test.txt"], { cwd: tempDir })
    execFileSync("git", ["commit", "-m", "initial commit"], { cwd: tempDir })

    execFileSync("git", ["checkout", "-b", "no-issue-branch"], { cwd: tempDir })

    const issueId = await getCurrentIssueFromVcs()
    expect(issueId).toBeNull()
  } finally {
    process.chdir(originalCwd)
    if (originalVcs !== undefined) {
      process.env["LINEAR_VCS"] = originalVcs
    } else {
      delete process.env["LINEAR_VCS"]
    }
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("startVcsWork - propagates git checkout errors when not in a git repo", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-vcs-test-"))
  const originalCwd = process.cwd()
  const originalVcs = process.env["LINEAR_VCS"]

  try {
    process.env["LINEAR_VCS"] = "git"
    process.chdir(tempDir)

    await expect(startVcsWork("ABC-123", "feature/ABC-123-test")).rejects.toThrow(
      "Failed to create branch",
    )
  } finally {
    process.chdir(originalCwd)
    if (originalVcs !== undefined) {
      process.env["LINEAR_VCS"] = originalVcs
    } else {
      delete process.env["LINEAR_VCS"]
    }
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("startVcsWork - propagates git checkout errors when source ref doesn't exist", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-vcs-test-"))
  const originalCwd = process.cwd()
  const originalVcs = process.env["LINEAR_VCS"]

  try {
    process.env["LINEAR_VCS"] = "git"
    process.chdir(tempDir)

    execFileSync("git", ["init"], { cwd: tempDir })
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: tempDir })
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: tempDir })

    await writeFile(join(tempDir, "test.txt"), "test")
    execFileSync("git", ["add", "test.txt"], { cwd: tempDir })
    execFileSync("git", ["commit", "-m", "initial commit"], { cwd: tempDir })

    // Try to create a branch from a non-existent ref
    await expect(startVcsWork("ABC-123", "feature/ABC-123-test", "nonexistent")).rejects.toThrow(
      "Failed to create branch",
    )
  } finally {
    process.chdir(originalCwd)
    if (originalVcs !== undefined) {
      process.env["LINEAR_VCS"] = originalVcs
    } else {
      delete process.env["LINEAR_VCS"]
    }
    await rm(tempDir, { recursive: true, force: true })
  }
})
