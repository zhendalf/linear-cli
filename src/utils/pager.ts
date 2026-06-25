import { spawn } from "node:child_process"
import { isStdoutTTY, getConsoleSize } from "./runtime.ts"

// Helper function to get the appropriate pager command
export function getPagerCommand(): { command: string; args: string[] } | null {
  // Respect user's PAGER environment variable
  const userPager = process.env["PAGER"]
  if (userPager) {
    // Split the pager command to handle cases like "less -R" or "more"
    const parts = userPager.trim().split(/\s+/)
    return {
      command: parts[0],
      args: parts.slice(1),
    }
  }

  // Platform-specific fallbacks with color support
  switch (process.platform) {
    case "win32":
      // Windows: try more first (built-in), then less if available
      return { command: "more", args: [] }
    case "darwin":
    case "linux":
    default:
      // Unix-like systems: prefer less with color support and no alternate screen
      return { command: "less", args: ["-R", "-X"] }
  }
}

// Helper function to pipe content through a single pager command
async function runPager(command: string, args: string[], content: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "inherit", "inherit"],
    })

    child.stdin.write(content, "utf8", (err) => {
      if (err) {
        child.stdin.destroy()
        resolve(false)
        return
      }
      child.stdin.end()
    })

    child.on("close", (code) => {
      resolve(code === 0)
    })

    child.on("error", () => {
      resolve(false)
    })
  })
}

// Helper function to try fallback pagers
async function tryFallbackPagers(content: string, failedPager: string): Promise<void> {
  const fallbacks: { command: string; args: string[] }[] = []

  if (process.platform === "win32") {
    // Windows fallbacks
    if (failedPager !== "more") fallbacks.push({ command: "more", args: [] })
    if (failedPager !== "less") fallbacks.push({ command: "less", args: ["-R", "-X"] })
  } else {
    // Unix-like fallbacks
    if (failedPager !== "less") fallbacks.push({ command: "less", args: ["-R", "-X"] })
    if (failedPager !== "more") fallbacks.push({ command: "more", args: [] })
    if (failedPager !== "cat") fallbacks.push({ command: "cat", args: [] })
  }

  for (const fallback of fallbacks) {
    try {
      const ok = await runPager(fallback.command, fallback.args, content)
      if (ok) return
    } catch {
      continue
    }
  }

  // If all pagers fail, output directly to console
  console.log(content)
}

/**
 * Pipe output to appropriate pager with color support
 */
export async function pipeToUserPager(content: string): Promise<void> {
  const pagerConfig = getPagerCommand()
  if (!pagerConfig) {
    console.log(content)
    return
  }

  try {
    const ok = await runPager(pagerConfig.command, pagerConfig.args, content)
    if (!ok) {
      await tryFallbackPagers(content, pagerConfig.command)
    }
  } catch {
    await tryFallbackPagers(content, pagerConfig.command)
  }
}

/**
 * Determine if output should be paged based on content length and terminal size
 */
export function shouldUsePager(outputLines: string[], usePager: boolean): boolean {
  if (!usePager || !isStdoutTTY()) {
    return false
  }

  try {
    const { rows: terminalHeight } = getConsoleSize()
    return outputLines.length > terminalHeight - 2 // Leave some space for shell prompt
  } catch {
    // If we can't get console size (e.g., in tests), don't use pager for short content
    return outputLines.length > 50 // Fallback threshold
  }
}
