import chalk from "chalk"
import { isStdoutTTY } from "./runtime.ts"

// Common styling patterns for consistency
export const error = (text: string) => chalk.red.bold(text)
export const success = (text: string) => chalk.green.bold(text)
export const info = (text: string) => chalk.blue(text)
export const warning = (text: string) => chalk.yellow(text)
export const muted = (text: string) => chalk.gray(text)
export const highlight = (text: string) => chalk.cyan.bold(text)
export const header = (text: string) => chalk.bold.underline(text)

/**
 * Strip `%c` CSS-directive tokens from a console.log format string.
 * Used when rendering outside a browser context (terminal, non-TTY).
 */
export function stripConsoleFormat(s: string): string {
  return s.replace(/%c/g, "")
}

/**
 * Convert a `console.log("%c...", "color:...", ...)` call into a chalk-styled string.
 *
 * Usage:
 *   applyConsoleFormat("Hello %c world %c end", "color:#ff0000", "color:gray;text-decoration:underline")
 *
 * Rules:
 *  - Each `%c` in the format string is replaced by switching chalk styles from the
 *    corresponding directive string argument.
 *  - Supported directives (semicolon-separated):
 *      color: <named | #hex>      → chalk foreground colour
 *      text-decoration: underline → chalk.underline
 *  - When NO_COLOR is set or stdout is not a TTY, returns plain text (directives stripped).
 *
 * @param format   The printf-style format string (may contain %c tokens)
 * @param directives  CSS directive strings, one per %c token (extra ones are ignored)
 */
export function applyConsoleFormat(format: string, ...directives: string[]): string {
  const noColor = process.env["NO_COLOR"] != null || !isStdoutTTY()

  if (noColor) {
    return stripConsoleFormat(format)
  }

  const parts = format.split("%c")
  if (parts.length === 1) {
    // No %c tokens — return as-is
    return format
  }

  // Build output by interleaving segments with styled re-opener
  let result = parts[0]

  for (let i = 1; i < parts.length; i++) {
    const directive = directives[i - 1] ?? ""
    const styledText = applyDirective(directive, parts[i])
    result += styledText
  }

  return result
}

/**
 * Apply a CSS directive string to a piece of text using chalk.
 * The directive is a semicolon-separated list of CSS-like declarations.
 */
function applyDirective(directive: string, text: string): string {
  if (!text) return text

  let instance = chalk

  const declarations = directive
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean)

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(":")
    if (colonIdx === -1) continue

    const prop = decl.slice(0, colonIdx).trim().toLowerCase()
    const value = decl
      .slice(colonIdx + 1)
      .trim()
      .toLowerCase()

    if (prop === "color") {
      instance = applyColorDirective(instance, value)
    } else if (prop === "text-decoration" && value === "underline") {
      instance = instance.underline
    }
  }

  return instance(text)
}

/** Map a CSS color value to a chalk instance */
function applyColorDirective(instance: typeof chalk, value: string): typeof chalk {
  if (value.startsWith("#")) {
    return instance.hex(value)
  }

  // Named colours — a practical subset of what the original code used
  switch (value) {
    case "red":
      return instance.red
    case "green":
      return instance.green
    case "yellow":
      return instance.yellow
    case "blue":
      return instance.blue
    case "magenta":
      return instance.magenta
    case "cyan":
      return instance.cyan
    case "white":
      return instance.white
    case "gray":
    case "grey":
      return instance.gray
    case "black":
      return instance.black
    default:
      // Unknown colour — leave unstyled
      return instance
  }
}
