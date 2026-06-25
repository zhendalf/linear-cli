/**
 * Thin wrappers over @inquirer/prompts (+ @inquirer/search) that command
 * modules call instead of importing cliffy directly.
 *
 * Cliffy call-shape → inquirer mapping:
 *
 *   Select.prompt({ message, options: [{name,value}], default?, search? })
 *     → select({ message, choices: [{name,value}], default? })
 *       or search({ message, source }) when search:true
 *
 *   Checkbox.prompt({ message, options: [{name,value}], search? })
 *     → checkbox({ message, choices: [{name,value}] })
 *
 *   Input.prompt({ message, default?, minLength? })
 *     → input({ message, default?, validate? })
 *
 *   Confirm.prompt({ message, default? })
 *     → confirm({ message, default? })
 *
 *   Secret.prompt({ message, hint? })
 *     → password({ message })
 *
 * Choice objects: cliffy used {name, value}; @inquirer/prompts also uses
 * {name, value} — the shape is compatible and needs no adaptation.
 */

import {
  checkbox as _checkbox,
  confirm as _confirm,
  input as _input,
  password as _password,
  select as _select,
} from "@inquirer/prompts"
import _search from "@inquirer/search"

// ---------------------------------------------------------------------------
// Shared choice type — mirrors cliffy {name, value} and inquirer {name, value}
// ---------------------------------------------------------------------------

export interface Choice<T = string> {
  name: string
  value: T
  /** Optional: render the choice differently from its value (unused by cliffy). */
  disabled?: boolean | string
}

// ---------------------------------------------------------------------------
// select
//
// Cliffy: Select.prompt({ message, options, default?, search? })
// Maps to inquirer `select` (or `search` when the caller passes search:true).
// The `search` flag is surfaced as a separate `searchSelect` export below so
// Phase D callers can replace `Select.prompt({ ..., search: true })` with the
// appropriate helper without any runtime branching here.
// ---------------------------------------------------------------------------

export interface SelectOptions<T = string> {
  message: string
  choices: Choice<T>[]
  default?: T
}

/** Non-searchable select — replaces `Select.prompt(...)` without search:true. */
export async function select<T = string>(opts: SelectOptions<T>): Promise<T> {
  return _select<T>({
    message: opts.message,
    choices: opts.choices,
    default: opts.default,
  })
}

// ---------------------------------------------------------------------------
// searchSelect
//
// Cliffy: Select.prompt({ message, options, search: true })
// Maps to @inquirer/search which provides fuzzy-filter as the user types.
// ---------------------------------------------------------------------------

export interface SearchSelectOptions<T = string> {
  message: string
  choices: Choice<T>[]
  // Note: @inquirer/search has no 'default' config field (unlike Select).
}

/** Searchable select — replaces `Select.prompt({ ..., search: true })`. */
export async function searchSelect<T = string>(opts: SearchSelectOptions<T>): Promise<T> {
  return _search<T>({
    message: opts.message,
    source: async (term: string | undefined) => {
      const q = (term ?? "").toLowerCase()
      return opts.choices
        .filter((c) => !q || c.name.toLowerCase().includes(q))
        .map((c) => ({ name: c.name, value: c.value }))
    },
    // Note: @inquirer/search has no 'default' config field; callers that need
    // a pre-selected default should filter/sort choices accordingly.
  })
}

// ---------------------------------------------------------------------------
// checkbox
//
// Cliffy: Checkbox.prompt({ message, options: [{name,value}], search? })
// Maps to inquirer checkbox.
//
// ⚠️ Cliffy's `search: true` / `searchLabel` (filterable multi-select, used by
// issue-create for labels) has NO inquirer equivalent — @inquirer/checkbox
// cannot filter. We render the full list without a search box; this is an
// accepted behaviour change. Sort the most-likely choices first for long lists.
// ---------------------------------------------------------------------------

export interface CheckboxOptions<T = string> {
  message: string
  choices: Choice<T>[]
}

/** Multi-select checkbox — replaces `Checkbox.prompt(...)`. */
export async function checkbox<T = string>(opts: CheckboxOptions<T>): Promise<T[]> {
  return _checkbox<T>({
    message: opts.message,
    choices: opts.choices,
  })
}

// ---------------------------------------------------------------------------
// input
//
// Cliffy: Input.prompt({ message, default?, minLength? })
// Maps to inquirer input with optional validate for minLength.
// ---------------------------------------------------------------------------

export interface InputOptions {
  message: string
  default?: string
  /** Minimum required length (cliffy minLength). */
  minLength?: number
}

/** Single-line text input — replaces `Input.prompt(...)`. */
export async function input(opts: InputOptions): Promise<string> {
  return _input({
    message: opts.message,
    default: opts.default,
    validate:
      opts.minLength != null
        ? (val) =>
            val.length >= (opts.minLength as number)
              ? true
              : `Minimum length is ${opts.minLength} character(s)`
        : undefined,
  })
}

// ---------------------------------------------------------------------------
// confirm
//
// Cliffy: Confirm.prompt({ message, default? })
// Maps to inquirer confirm.
// ---------------------------------------------------------------------------

export interface ConfirmOptions {
  message: string
  default?: boolean
}

/** Boolean yes/no confirm — replaces `Confirm.prompt(...)`. */
export async function confirm(opts: ConfirmOptions): Promise<boolean> {
  return _confirm({
    message: opts.message,
    default: opts.default,
  })
}

// ---------------------------------------------------------------------------
// password
//
// Cliffy: Secret.prompt({ message, hint? })
// Maps to inquirer password (hint is surfaced as part of the message string
// by the caller if needed; there is no direct hint field in inquirer).
// ---------------------------------------------------------------------------

export interface PasswordOptions {
  message: string
  /** Informational hint text — prepend to message or log separately. */
  hint?: string
}

/** Masked password/secret input — replaces `Secret.prompt(...)`. */
export async function password(opts: PasswordOptions): Promise<string> {
  return _password({
    message: opts.message,
    mask: "*",
  })
}
