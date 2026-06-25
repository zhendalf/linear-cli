/**
 * Thin wrapper around `ora` that replaces `@std/cli/unstable-spinner`.
 *
 * Cliffy usage pattern observed across ~50 dynamic-import sites:
 *
 *   const { Spinner } = await import("@std/cli/unstable-spinner")
 *   const spinner = shouldShowSpinner() ? new Spinner({ message: "..." }) : null
 *   spinner?.start()
 *   spinner?.stop()          // plain stop (no success/fail symbol)
 *   spinner.message = "..."  // one site (team-delete.ts)
 *
 * Replacement pattern in Phase D:
 *
 *   import { createSpinner } from "../../utils/spinner.ts"
 *   const spinner = createSpinner("...")
 *   spinner.start()
 *   spinner.stop()           // maps to ora .stop()
 *   spinner.succeed("msg")   // optional: stop with ✔
 *   spinner.fail("msg")      // optional: stop with ✖
 *   spinner.text = "..."     // live text update (maps to ora .text)
 *
 * `createSpinner` is always synchronous; there is no conditional null —
 * callers that previously did `showSpinner ? new Spinner() : null` should
 * instead import `shouldShowSpinner` from utils/hyperlink.ts and either
 * skip calling start() or use the `enabled` option exposed here.
 */

import ora, { type Ora } from "ora"

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

export interface SpinnerHandle {
  /** Start the spinner. No-op if disabled. */
  start(text?: string): this
  /** Stop and clear the spinner (no symbol). */
  stop(): this
  /** Stop with a ✔ success symbol. */
  succeed(text?: string): this
  /** Stop with a ✖ failure symbol. */
  fail(text?: string): this
  /** Update the spinner label in place (maps to ora .text). */
  set text(value: string)
  get text(): string
}

/** Internal implementation backed by an ora instance. */
class OraSpinner implements SpinnerHandle {
  private _ora: Ora

  constructor(text?: string, enabled = true) {
    this._ora = ora({
      text,
      // ora honours NO_COLOR and non-TTY automatically, but the enabled flag
      // gives callers explicit control (e.g. when shouldShowSpinner() is false).
      isEnabled: enabled,
    })
  }

  start(text?: string): this {
    if (text !== undefined) this._ora.text = text
    this._ora.start()
    return this
  }

  stop(): this {
    this._ora.stop()
    return this
  }

  succeed(text?: string): this {
    this._ora.succeed(text)
    return this
  }

  fail(text?: string): this {
    this._ora.fail(text)
    return this
  }

  set text(value: string) {
    this._ora.text = value
  }

  get text(): string {
    return this._ora.text
  }
}

/**
 * No-op spinner used when disabled. ora's `isEnabled: false` is NOT silent — it
 * still writes the label text (without frames/ANSI), which would contaminate
 * piped/--json output. This handle writes nothing at all, preserving the old
 * `showSpinner ? new Spinner() : null` behaviour.
 */
class NoopSpinner implements SpinnerHandle {
  private _text: string

  constructor(text = "") {
    this._text = text
  }

  start(text?: string): this {
    if (text !== undefined) this._text = text
    return this
  }
  stop(): this {
    return this
  }
  succeed(text?: string): this {
    if (text !== undefined) this._text = text
    return this
  }
  fail(text?: string): this {
    if (text !== undefined) this._text = text
    return this
  }
  set text(value: string) {
    this._text = value
  }
  get text(): string {
    return this._text
  }
}

// ---------------------------------------------------------------------------
// Factory
//
// Usage:
//   import { createSpinner } from "../../utils/spinner.ts"
//   import { shouldShowSpinner } from "../../utils/hyperlink.ts"
//
//   const spinner = createSpinner("Loading...", shouldShowSpinner())
//   spinner.start()
//   // ... async work ...
//   spinner.stop()
// ---------------------------------------------------------------------------

/**
 * Create a new spinner handle.
 *
 * @param text    Initial spinner label (displayed next to the animation).
 * @param enabled Pass `false` to create a no-op spinner (replaces the
 *                `showSpinner ? new Spinner() : null` pattern — the caller
 *                can always call methods without null-checks).
 */
export function createSpinner(text?: string, enabled = true): SpinnerHandle {
  return enabled ? new OraSpinner(text, true) : new NoopSpinner(text)
}
