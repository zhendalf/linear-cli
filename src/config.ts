/**
 * Config loader: reads `.linear.toml` (global + project + git-root) and
 * `.env` files, then exposes a typed `getOption()` accessor.
 *
 * `init()` does the loading and is exported so tests can run it in a
 * controlled environment; the module also calls `init()` at import time so
 * config is ready by the time any command runs.
 */

import { readFileSync } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { parse as parseDotenv } from "dotenv"
import { parse as parseToml } from "smol-toml"
import * as v from "valibot"
import { ValidationError } from "./utils/errors.ts"
import { isWindows, runCommand } from "./utils/runtime.ts"

let config: Record<string, unknown> = {}

// ---------------------------------------------------------------------------
// TOML file loading
// ---------------------------------------------------------------------------

async function loadConfigFromPath(path: string): Promise<Record<string, unknown> | null> {
  try {
    const file = await readFile(path, "utf8")
    return parseToml(file) as Record<string, unknown>
  } catch {
    return null
  }
}

async function loadConfig(): Promise<void> {
  // Start from a clean slate so repeated init() calls don't accumulate stale
  // keys from a previously-loaded config (relevant when cwd/env change, e.g.
  // tests, but also correct in general).
  config = {}

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
  const projectConfigPaths = ["./linear.toml", "./.linear.toml"]
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

export const ISSUE_SORT_VALUES = ["manual", "priority"] as const
export type IssueSort = (typeof ISSUE_SORT_VALUES)[number]
export const DEFAULT_ISSUE_SORT: IssueSort = "priority"

// Options schema
const OptionsSchema = v.object({
  team_id: v.optional(v.string()),
  api_key: v.optional(v.string()),
  workspace: v.optional(v.string()),
  issue_sort: v.optional(v.picklist(ISSUE_SORT_VALUES)),
  vcs: v.optional(v.picklist(["git", "jj"])),
  download_images: v.optional(BooleanLike),
  hyperlink_format: v.optional(v.string()),
  attachment_dir: v.optional(v.string()),
  auto_download_attachments: v.optional(BooleanLike),
})

export type Options = v.InferOutput<typeof OptionsSchema>
export type OptionName = keyof Options

function getRawOption(optionName: OptionName, cliValue?: string): unknown {
  return cliValue ?? process.env["LINEAR_" + optionName.toUpperCase()] ?? config[optionName]
}

export function getOption<T extends OptionName>(optionName: T, cliValue?: string): Options[T] {
  const raw = getRawOption(optionName, cliValue)
  const result = v.safeParse(OptionsSchema, { [optionName]: raw })
  if (result.success) {
    return result.output[optionName] as Options[T]
  }
  return undefined as Options[T]
}

/**
 * Resolve the issue sort order from the `--sort` flag, the LINEAR_ISSUE_SORT
 * env var, or the `issue_sort` config option, defaulting to priority when
 * nothing is set. Unlike getOption, an explicitly configured but invalid value
 * errors instead of silently falling back to the default.
 */
export function resolveIssueSort(cliValue?: string): IssueSort {
  const raw = getRawOption("issue_sort", cliValue)
  if (raw == null) return DEFAULT_ISSUE_SORT
  const parsed = v.safeParse(v.picklist(ISSUE_SORT_VALUES), raw)
  if (!parsed.success) {
    throw new ValidationError(`Invalid issue sort: ${JSON.stringify(raw)}`, {
      suggestion: `Use one of: ${ISSUE_SORT_VALUES.join(
        ", ",
      )} (via --sort, the issue_sort config option, or the LINEAR_ISSUE_SORT environment variable)`,
    })
  }
  return parsed.output
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
