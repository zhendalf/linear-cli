import { afterAll, afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// CRITICAL: point XDG_CONFIG_HOME at a temp dir BEFORE importing src/credentials.ts,
// because that module runs a top-level `await loadCredentials()` at import time.
// Setting it here (module scope, before the dynamic import below) guarantees the
// suite NEVER reads or writes the real ~/.config/linear.
const moduleScopeConfigDir = mkdtempSync(join(tmpdir(), "linear-cred-boot-"))
const origBootXdg = process.env["XDG_CONFIG_HOME"]
process.env["XDG_CONFIG_HOME"] = moduleScopeConfigDir

// Dynamic import AFTER the env var is set so the module's top-level
// loadCredentials() resolves against our temp dir, not the user's home.
const {
  loadCredentials,
  addCredential,
  removeCredential,
  setDefaultWorkspace,
  getCredentialApiKey,
  getDefaultWorkspace,
  getWorkspaces,
  hasWorkspace,
  getCredentialsPath,
} = await import("../src/credentials.ts")

const { getResolvedApiKey } = await import("../src/utils/graphql.ts")
const { setCliWorkspace, init: initConfig } = await import("../src/config.ts")

let tempDir: string
let origXdgConfigHome: string | undefined
let origLinearApiKey: string | undefined
let origCwd: string

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "linear-cred-test-"))
  origXdgConfigHome = process.env["XDG_CONFIG_HOME"]
  origLinearApiKey = process.env["LINEAR_API_KEY"]
  origCwd = process.cwd()
  process.env["XDG_CONFIG_HOME"] = tempDir
  delete process.env["LINEAR_API_KEY"]
  setCliWorkspace(undefined)
  // Reset in-memory state by reloading from the (empty) temp dir
  await loadCredentials()
})

afterEach(async () => {
  process.chdir(origCwd)
  if (origXdgConfigHome != null) {
    process.env["XDG_CONFIG_HOME"] = origXdgConfigHome
  } else {
    delete process.env["XDG_CONFIG_HOME"]
  }
  if (origLinearApiKey != null) {
    process.env["LINEAR_API_KEY"] = origLinearApiKey
  } else {
    delete process.env["LINEAR_API_KEY"]
  }
  setCliWorkspace(undefined)
  // Reload config from the restored cwd so other test files are unaffected.
  await initConfig()
  await rm(tempDir, { recursive: true, force: true })
})

afterAll(async () => {
  if (origBootXdg != null) {
    process.env["XDG_CONFIG_HOME"] = origBootXdg
  } else {
    delete process.env["XDG_CONFIG_HOME"]
  }
  await rm(moduleScopeConfigDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Path / store behavior
// ---------------------------------------------------------------------------

test("credentials - getCredentialsPath returns correct path", () => {
  const path = getCredentialsPath()
  expect(path).toBeTruthy()
  expect(path).toContain("linear")
  expect(path).toContain("credentials.json")
  // Must resolve under our temp dir, NOT the real ~/.config/linear.
  expect(path).toContain(tempDir)
})

test("credentials - loadCredentials returns empty when no file", async () => {
  const creds = await loadCredentials()
  expect(creds.workspaces).toEqual([])
  expect(creds.default).toBeUndefined()
})

test("credentials - addCredential creates file and sets default", async () => {
  await addCredential("test-workspace", "lin_api_test123")
  expect(getDefaultWorkspace()).toBe("test-workspace")
  expect(getCredentialApiKey("test-workspace")).toBe("lin_api_test123")
})

test("credentials - addCredential preserves existing default", async () => {
  await addCredential("first-workspace", "lin_api_first")
  await addCredential("second-workspace", "lin_api_second")
  expect(getDefaultWorkspace()).toBe("first-workspace")
})

test("credentials - file is written with mode 0600", async () => {
  await addCredential("my-workspace", "lin_api_key")
  const path = getCredentialsPath()!
  const stats = await stat(path)
  // On Unix, check that mode is exactly 0600.
  if (process.platform !== "win32") {
    expect(stats.mode & 0o777).toBe(0o600)
  }
})

test("credentials - JSON file contains API key", async () => {
  await addCredential("my-workspace", "lin_api_plain")
  const path = getCredentialsPath()!
  const content = await readFile(path, "utf8")
  const parsed = JSON.parse(content)
  expect(parsed["my-workspace"]).toBe("lin_api_plain")
})

test("credentials - removeCredential deletes workspace", async () => {
  await addCredential("workspace-a", "lin_api_a")
  await addCredential("workspace-b", "lin_api_b")
  await removeCredential("workspace-a")
  expect(getWorkspaces()).toEqual(["workspace-b"])
})

test("credentials - removeCredential reassigns default", async () => {
  await addCredential("workspace-a", "lin_api_a")
  await addCredential("workspace-b", "lin_api_b")
  await removeCredential("workspace-a")
  expect(getDefaultWorkspace()).toBe("workspace-b")
})

test("credentials - removeCredential cleans up cache", async () => {
  await addCredential("workspace-a", "lin_api_a")
  await removeCredential("workspace-a")
  expect(getCredentialApiKey("workspace-a")).toBeUndefined()
})

test("credentials - setDefaultWorkspace changes default", async () => {
  await addCredential("workspace-a", "lin_api_a")
  await addCredential("workspace-b", "lin_api_b")
  await setDefaultWorkspace("workspace-b")
  expect(getDefaultWorkspace()).toBe("workspace-b")
})

test("credentials - getCredentialApiKey returns key for workspace", async () => {
  await addCredential("my-workspace", "lin_api_mykey")
  expect(getCredentialApiKey("my-workspace")).toBe("lin_api_mykey")
})

test("credentials - getCredentialApiKey returns default when no workspace specified", async () => {
  await addCredential("default-workspace", "lin_api_default")
  expect(getCredentialApiKey()).toBe("lin_api_default")
})

test("credentials - getCredentialApiKey returns undefined for unknown workspace", async () => {
  await addCredential("known-workspace", "lin_api_known")
  expect(getCredentialApiKey("unknown-workspace")).toBeUndefined()
})

test("credentials - hasWorkspace returns correct boolean", async () => {
  await addCredential("exists", "lin_api_exists")
  expect(hasWorkspace("exists")).toBe(true)
  expect(hasWorkspace("not-exists")).toBe(false)
})

test("credentials - setDefaultWorkspace throws for unknown workspace", async () => {
  await addCredential("workspace-a", "lin_api_a")
  await expect(setDefaultWorkspace("nonexistent")).rejects.toThrow("nonexistent")
})

// ---------------------------------------------------------------------------
// getResolvedApiKey precedence chain (project hard requirement)
//
// Precedence (highest → lowest):
//   1. LINEAR_API_KEY env var          (conflicts with --workspace)
//   2. literal `api_key` in .linear.toml
//   3. --workspace flag → stored key   (error if unknown)
//   4. .linear.toml `workspace = "X"`  → stored key for X
//   5. default workspace from credentials file
//
// Each test below pins one rung AND its ordering relative to lower rungs, so a
// regression in any rung turns the suite red.
// ---------------------------------------------------------------------------

/**
 * Set up a temp project dir containing the given `.linear.toml` body, chdir into
 * it, and re-run config init so getOption() reads the new project config.
 */
async function useProjectConfig(tomlBody: string): Promise<void> {
  const projectDir = await mkdtemp(join(tmpdir(), "linear-proj-"))
  await writeFile(join(projectDir, ".linear.toml"), tomlBody, "utf8")
  process.chdir(projectDir)
  await initConfig()
}

test("getResolvedApiKey - rung 1: LINEAR_API_KEY env wins over stored default", async () => {
  await addCredential("stored-ws", "lin_api_stored")
  process.env["LINEAR_API_KEY"] = "lin_api_env"
  expect(getResolvedApiKey()).toBe("lin_api_env")
})

test("getResolvedApiKey - rung 1 ordering: env wins even over literal api_key in .linear.toml", async () => {
  await useProjectConfig('api_key = "lin_api_from_toml"\n')
  process.env["LINEAR_API_KEY"] = "lin_api_env"
  expect(getResolvedApiKey()).toBe("lin_api_env")
})

test("getResolvedApiKey - conflict: env + --workspace throws", async () => {
  await addCredential("stored-ws", "lin_api_stored")
  process.env["LINEAR_API_KEY"] = "lin_api_env"
  setCliWorkspace("stored-ws")
  expect(() => getResolvedApiKey()).toThrow(
    "Cannot use --workspace flag when LINEAR_API_KEY environment variable is set",
  )
})

test("getResolvedApiKey - rung 2: literal api_key in .linear.toml wins over --workspace and default", async () => {
  await addCredential("stored-ws", "lin_api_stored")
  await useProjectConfig('api_key = "lin_api_from_toml"\n')
  // Even with a --workspace flag pointing at a stored key, the literal api_key wins.
  setCliWorkspace("stored-ws")
  // (no env key set)
  expect(getResolvedApiKey()).toBe("lin_api_from_toml")
})

test("getResolvedApiKey - rung 3: --workspace flag resolves to that workspace's stored key", async () => {
  await addCredential("default-ws", "lin_api_default")
  await addCredential("other-ws", "lin_api_other")
  // default is default-ws, but --workspace other-ws must override it
  setCliWorkspace("other-ws")
  expect(getResolvedApiKey()).toBe("lin_api_other")
})

test("getResolvedApiKey - rung 3: --workspace flag for unknown workspace throws", async () => {
  await addCredential("known-ws", "lin_api_known")
  setCliWorkspace("does-not-exist")
  expect(() => getResolvedApiKey()).toThrow('Workspace "does-not-exist" not found in credentials')
})

test("getResolvedApiKey - rung 4: .linear.toml workspace= resolves to that workspace's stored key over default", async () => {
  await addCredential("default-ws", "lin_api_default")
  await addCredential("project-ws", "lin_api_project")
  // default is default-ws, but project config selects project-ws
  await useProjectConfig('workspace = "project-ws"\n')
  expect(getResolvedApiKey()).toBe("lin_api_project")
})

test("getResolvedApiKey - rung 4 ordering: --workspace flag wins over .linear.toml workspace=", async () => {
  await addCredential("flag-ws", "lin_api_flag")
  await addCredential("config-ws", "lin_api_config")
  await useProjectConfig('workspace = "config-ws"\n')
  setCliWorkspace("flag-ws")
  expect(getResolvedApiKey()).toBe("lin_api_flag")
})

test("getResolvedApiKey - rung 5: default workspace fallback when no env/flag/config", async () => {
  await addCredential("only-ws", "lin_api_only")
  // No env, no flag; config has no api_key/workspace.
  await useProjectConfig("# empty project config\n")
  setCliWorkspace(undefined)
  expect(getResolvedApiKey()).toBe("lin_api_only")
})
