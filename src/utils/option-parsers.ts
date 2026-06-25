/**
 * Reusable commander option argParsers for repeatable ("collect") flags.
 *
 * IMPORTANT: never combine these with `.default([...])` on the Option — commander
 * passes the default as `prev` on the first user value, so explicit values would
 * APPEND to the default instead of replacing it. Apply any default in the action
 * (`const xs = options.x ?? [...]`) when the option is undefined.
 */
import { InvalidArgumentError } from "commander"

/** Accumulate repeated string values into an array. */
export function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value]
}

/**
 * Accumulate repeated values, validating each against an allow-list (replaces
 * cliffy `EnumType` on a repeatable option). Throws at parse time on bad input.
 */
export function collectEnum(allowed: readonly string[], label: string) {
  return (value: string, previous: string[] = []): string[] => {
    if (!allowed.includes(value)) {
      throw new InvalidArgumentError(`Invalid ${label} "${value}". Choices: ${allowed.join(", ")}.`)
    }
    return [...previous, value]
  }
}

/** Linear workflow state types, used by `issue mine` / `issue query` --state. */
export const ISSUE_STATE_TYPES = [
  "triage",
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const
