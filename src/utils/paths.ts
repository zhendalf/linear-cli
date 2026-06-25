/**
 * Shared config/data directory resolution.
 *
 * Decision (from PORT_PLAN.md §7, locked):
 *   Keep ~/.config/linear on macOS/Linux so existing configs are found in-place.
 *   Use env-paths as a fallback for Windows (%APPDATA%/linear).
 *
 * XDG rules:
 *   $XDG_CONFIG_HOME/linear   (if set)
 *   ~/.config/linear           (default)
 * Windows:
 *   %APPDATA%/linear
 */

import { join } from "node:path"
import envPaths from "env-paths"

/**
 * Returns the config directory for the linear CLI.
 * Respects XDG_CONFIG_HOME on Unix-like systems; falls back to
 * %APPDATA%/linear on Windows (via env-paths).
 */
export function configDir(): string {
  if (process.platform === "win32") {
    // env-paths uses %APPDATA% on Windows which is the correct location
    return envPaths("linear", { suffix: "" }).config
  }

  // Unix-like: XDG Base Directory Specification
  const xdgConfigHome = process.env["XDG_CONFIG_HOME"]
  if (xdgConfigHome) {
    return join(xdgConfigHome, "linear")
  }

  const home = process.env["HOME"]
  if (home) {
    return join(home, ".config", "linear")
  }

  // Last resort: env-paths (will point to ~/Library/Preferences/linear on macOS,
  // but we should never reach here since HOME is always set)
  return envPaths("linear", { suffix: "" }).config
}

/**
 * Full path to the credentials JSON file.
 */
export function credentialsFilePath(): string {
  return join(configDir(), "credentials.json")
}
