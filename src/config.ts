/**
 * Config loader: reads `.linear.toml` (global + project + git-root) and
 * `.env` files, then exposes a typed `getOption()` accessor.
 *
 * Ported from Deno: @std/toml → smol-toml, @std/path → node:path,
 * @std/dotenv → dotenv (programmatic parse), Deno.Command → runCommand,
 * Deno.env → process.env, Deno.build.os → isWindows.
 *
 * Module-top `await` replaced with an explicit `init()` for testability, but
 * the module still calls `init()` at import time to preserve the existing
 * behaviour (config is ready by the time any command runs).
 */

import { parse as parseToml } from "smol-toml"
import { join } from "node:path"
import { readFileSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { parse as parseDotenv } from "dotenv"
import * as v from "valibot"
import { runCommand, isWindows } from "./utils/runtime.ts"

let config: Record<string, unknown> = {}

// ---------------------------------------------------------------------------
// TOML file loading
// ---------------------------------------------------------------------------

async function loadConfigFromPath(
  path: string,
): Promise<Record<string, unknown> | null> {
  try {
    const file = await readFile(path, "utf8")
    return parseToml(file) as Record<string, unknown>
  } catch {
    return null
  }
}

async function loadConfig(): Promise<void> {
  // Build list of global config paths (lowest priority)
  const globalConfigPaths: string[] = []
  if (isWindows) {
    // Windows: use APPDATA (Roaming) for user config
    const appData = process.env["APPDATA"]
    if (appData) {
      globalConfigPaths.push(join(appData, "linear", "linear.toml"))
    }
  } else {
    // Unix-like: follow XDG Base Directory Specification
    const xdgConfigHome = process.env["XDG_CONFIG_HOME"]
    const homeDir = process.env["HOME"]
    if (xdgConfigHome) {
      globalConfigPaths.push(join(xdgConfigHome, "linear", "linear.toml"))
    } else if (homeDir) {
      globalConfigPaths.push(join(homeDir, ".config", "linear", "linear.toml"))
    }
  }

  // Build list of project config paths (higher priority, overrides global)
  const projectConfigPaths = [
    "./linear.toml",
    "./.linear.toml",
  ]
  const gitResult = await runCommand("git", ["rev-parse", "--show-toplevel"])
  if (gitResult.success) {
    const gitRoot = gitResult.stdout.trim()
    projectConfigPaths.push(join(gitRoot, "linear.toml"))
    projectConfigPaths.push(join(gitRoot, ".linear.toml"))
    projectConfigPaths.push(join(gitRoot, ".config", "linear.toml"))
  }

  // Load global config first (lowest priority)
  for (const path of globalConfigPaths) {
    const globalConfig = await loadConfigFromPath(path)
    if (globalConfig) {
      config = globalConfig
      break
    }
  }

  // Load project config and merge on top (project overrides global)
  for (const path of projectConfigPaths) {
    const projectConfig = await loadConfigFromPath(path)
    if (projectConfig) {
      config = { ...config, ...projectConfig }
      break
    }
  }
}

// ---------------------------------------------------------------------------
// .env file loading
// ---------------------------------------------------------------------------

/** Parse a .env file at `path` and return key-value pairs. */
function parseDotenvFile(path: string): Record<string, string> {
  try {
    const content = readFileSync(path, "utf8")
    return parseDotenv(content)
  } catch {
    return {}
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile()
  } catch {
    return false
  }
}

async function loadEnvFiles(): Promise<void> {
  let envVars: Record<string, string> = {}

  if (await fileExists(".env")) {
    envVars = parseDotenvFile(".env")
  } else {
    const gitResult = await runCommand("git", ["rev-parse", "--show-toplevel"])
    if (gitResult.success) {
      const gitRoot = gitResult.stdout.trim()
      const gitRootEnvPath = join(gitRoot, ".env")
      if (await fileExists(gitRootEnvPath)) {
        envVars = parseDotenvFile(gitRootEnvPath)
      }
    }
  }

  // Apply known environment variables from .env (same precedence as dotenv)
  const ALLOWED_ENV_VAR_PREFIXES = ["LINEAR_", "GH_", "GITHUB_"]
  for (const [key, value] of Object.entries(envVars)) {
    if (ALLOWED_ENV_VAR_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      // dotenv precedence: don't override an already-set env var
      if (process.env[key] !== undefined) continue
      process.env[key] = value
    }
  }
}

// ---------------------------------------------------------------------------
// Public init — called at module load (top-level await preserved for compat)
// ---------------------------------------------------------------------------

/**
 * Initialise config + env-file loading.
 * Exported so tests can call it explicitly in a controlled environment.
 * The module itself calls it at import time via top-level await.
 */
export async function init(): Promise<void> {
  await loadEnvFiles()
  await loadConfig()
}

await init()

// ---------------------------------------------------------------------------
// Schema + option accessor
// ---------------------------------------------------------------------------

// Boolean coercion following Python's distutils.util.strtobool standard
const TRUTHY = ["true", "yes", "y", "on", "1", "t"]
const FALSY = ["false", "no", "n", "off", "0", "f"]

function coerceBool(value: unknown): boolean | undefined {
  if (value === true) return true
  if (value === false) return false
  if (value == null) return undefined
  if (typeof value === "string") {
    const lower = value.toLowerCase()
    if (TRUTHY.includes(lower)) return true
    if (FALSY.includes(lower)) return false
  }
  return undefined
}

// Custom valibot schema for boolean coercion
const BooleanLike = v.pipe(v.unknown(), v.transform(coerceBool))

// Options schema
const OptionsSchema = v.object({
  team_id: v.optional(v.string()),
  api_key: v.optional(v.string()),
  workspace: v.optional(v.string()),
  issue_sort: v.optional(v.picklist(["manual", "priority"])),
  vcs: v.optional(v.picklist(["git", "jj"])),
  download_images: v.optional(BooleanLike),
  hyperlink_format: v.optional(v.string()),
  attachment_dir: v.optional(v.string()),
  auto_download_attachments: v.optional(BooleanLike),
})

export type Options = v.InferOutput<typeof OptionsSchema>
export type OptionName = keyof Options

function getRawOption(optionName: OptionName, cliValue?: string): unknown {
  return (
    cliValue ??
    process.env["LINEAR_" + optionName.toUpperCase()] ??
    config[optionName]
  )
}

export function getOption<T extends OptionName>(
  optionName: T,
  cliValue?: string,
): Options[T] {
  const raw = getRawOption(optionName, cliValue)
  const result = v.safeParse(OptionsSchema, { [optionName]: raw })
  if (result.success) {
    return result.output[optionName] as Options[T]
  }
  return undefined as Options[T]
}

// ---------------------------------------------------------------------------
// CLI workspace (--workspace flag)
// ---------------------------------------------------------------------------

let cliWorkspace: string | undefined

export function setCliWorkspace(workspace: string | undefined): void {
  cliWorkspace = workspace
}

export function getCliWorkspace(): string | undefined {
  return cliWorkspace
}
