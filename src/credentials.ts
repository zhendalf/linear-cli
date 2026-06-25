/**
 * Credentials store — JSON-backed, 0600 permissions.
 *
 * File format: { "default": "<workspace>", "<workspace>": "lin_api_...", ... }
 *
 * All keyring/migration code has been removed (PORT_PLAN.md §7, locked decision).
 * Users must re-run `linear auth login` after upgrading from the Deno release.
 */

import { readFile, writeFile, mkdir, chmod } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname } from "node:path"
import { credentialsFilePath } from "./utils/paths.ts"
import { isWindows } from "./utils/runtime.ts"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Credentials {
  default?: string
  workspaces: string[]
}

/** Serialized shape of the credentials JSON file. */
interface CredentialsJson {
  default?: string
  [workspace: string]: string | undefined
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let credentials: Credentials = { workspaces: [] }
const apiKeyCache = new Map<string, string>()

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Get the path to the credentials file.
 * Returns null only when the OS provides no usable directory (extremely rare).
 */
export function getCredentialsPath(): string | null {
  return credentialsFilePath()
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function parseCredentialsJson(parsed: CredentialsJson): Credentials {
  const workspaces: string[] = []
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "default") continue
    if (typeof value === "string") {
      workspaces.push(key)
      apiKeyCache.set(key, value)
    }
  }
  return {
    default: typeof parsed.default === "string" ? parsed.default : undefined,
    workspaces,
  }
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

/**
 * Load credentials from disk.
 * Safe to call multiple times; each call resets in-memory state from disk.
 */
export async function loadCredentials(): Promise<Credentials> {
  const path = getCredentialsPath()
  if (!path) {
    return { workspaces: [] }
  }

  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === "ENOENT") {
      credentials = { workspaces: [] }
      apiKeyCache.clear()
      return credentials
    }
    throw new Error(
      `Failed to read credentials file at ${path}: ${e.message}`,
    )
  }

  let parsed: CredentialsJson
  try {
    parsed = JSON.parse(raw) as CredentialsJson
  } catch (err) {
    throw new Error(
      `Failed to parse credentials file at ${path}. The file may be corrupted.\n` +
        `You can delete it and re-authenticate with \`linear auth login\`.\n` +
        `Parse error: ${(err as Error).message}`,
    )
  }

  apiKeyCache.clear()
  credentials = parseCredentialsJson(parsed)
  return credentials
}

/**
 * Persist the current in-memory credentials to disk with mode 0600.
 */
async function save(): Promise<void> {
  const path = getCredentialsPath()
  if (!path) {
    throw new Error("Could not determine credentials path")
  }

  // Ensure the directory exists
  await mkdir(dirname(path), { recursive: true })

  // Build ordered JSON object: default first, then workspaces alphabetically
  const ordered: CredentialsJson = {}
  if (credentials.default != null) {
    ordered.default = credentials.default
  }
  for (const ws of [...credentials.workspaces].sort()) {
    const key = apiKeyCache.get(ws)
    if (key == null) {
      throw new Error(
        `Cannot save credentials: API key for workspace "${ws}" is missing from cache`,
      )
    }
    ordered[ws] = key
  }

  const content = JSON.stringify(ordered, null, 2) + "\n"
  await writeFile(path, content, { mode: 0o600 })

  // Explicit chmod to ensure mode even if umask was restrictive
  if (!isWindows) {
    try {
      await chmod(path, 0o600)
    } catch {
      // Non-fatal: best effort on unusual filesystems
    }
  }
}

// ---------------------------------------------------------------------------
// Public API — matches the exported surface expected by all callers
// ---------------------------------------------------------------------------

/**
 * Add or update a credential.
 * If this is the first workspace, it becomes the default.
 */
export async function addCredential(
  workspace: string,
  apiKey: string,
  // options param kept for API compatibility with callers that pass { plaintext }
  _options?: { plaintext?: boolean },
): Promise<void> {
  apiKeyCache.set(workspace, apiKey)

  const isNew = !credentials.workspaces.includes(workspace)
  if (isNew) {
    credentials.workspaces.push(workspace)
  }

  // If this is the first workspace, make it the default
  if (isNew && credentials.workspaces.length === 1) {
    credentials.default = workspace
  }

  await save()
}

/**
 * Remove a credential.
 * If removing the default, reassigns to the next available workspace.
 */
export async function removeCredential(workspace: string): Promise<void> {
  apiKeyCache.delete(workspace)
  credentials.workspaces = credentials.workspaces.filter((w) => w !== workspace)

  // If we removed the default, reassign it
  if (credentials.default === workspace) {
    credentials.default = credentials.workspaces[0]
  }

  await save()
}

/**
 * Set the default workspace.
 */
export async function setDefaultWorkspace(workspace: string): Promise<void> {
  if (!credentials.workspaces.includes(workspace)) {
    throw new Error(`Workspace "${workspace}" not found in credentials`)
  }
  credentials.default = workspace
  await save()
}

/**
 * Get the API key for a workspace (or the default workspace if not specified).
 */
export function getCredentialApiKey(workspace?: string): string | undefined {
  if (workspace != null) {
    return apiKeyCache.get(workspace)
  }
  if (credentials.default != null) {
    return apiKeyCache.get(credentials.default)
  }
  return undefined
}

/**
 * Get the current default workspace slug.
 */
export function getDefaultWorkspace(): string | undefined {
  return credentials.default
}

/**
 * Get all configured workspaces.
 */
export function getWorkspaces(): string[] {
  return [...credentials.workspaces]
}

/**
 * Check if a workspace is configured.
 */
export function hasWorkspace(workspace: string): boolean {
  return credentials.workspaces.includes(workspace)
}

// ---------------------------------------------------------------------------
// Module initialisation: load credentials at import time (top-level await)
// ---------------------------------------------------------------------------
await loadCredentials()
