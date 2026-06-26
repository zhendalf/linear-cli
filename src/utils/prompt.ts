/**
 * Thin wrappers over @inquirer/prompts (+ @inquirer/search). Command modules
 * import these helpers (`select`, `searchSelect`, `checkbox`, `input`,
 * `confirm`, `password`) so all interactive prompts share one small, typed API
 * and a consistent `{ message, choices: [{ name, value }] }` shape.
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
// Shared choice type — { name, value } pairs used by every prompt helper.
// ---------------------------------------------------------------------------

export interface Choice<T = string> {
  name: string
  value: T
  /** Disable the choice, optionally with a reason string. */
  disabled?: boolean | string
}

// ---------------------------------------------------------------------------
// select
//
// A plain single-select prompt. For a filterable variant, use `searchSelect`.
// ---------------------------------------------------------------------------

export interface SelectOptions<T = string> {
  message: string
  choices: Choice<T>[]
  default?: T
}

/** Non-searchable single-select prompt. */
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
// Single-select prompt with fuzzy-filter as the user types (via
// @inquirer/search).
// ---------------------------------------------------------------------------

export interface SearchSelectOptions<T = string> {
  message: string
  choices: Choice<T>[]
  // Note: @inquirer/search has no 'default' config field.
}

/** Searchable single-select prompt. */
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
// Multi-select prompt.
//
// ⚠️ @inquirer/checkbox has no built-in filtering, so the full list is rendered
// without a search box. For long lists (e.g. labels in issue-create), sort the
// most-likely choices first.
// ---------------------------------------------------------------------------

export interface CheckboxOptions<T = string> {
  message: string
  choices: Choice<T>[]
}

/** Multi-select checkbox prompt. */
export async function checkbox<T = string>(opts: CheckboxOptions<T>): Promise<T[]> {
  return _checkbox<T>({
    message: opts.message,
    choices: opts.choices,
  })
}

// ---------------------------------------------------------------------------
// input
//
// Single-line text input, with optional minimum-length validation.
// ---------------------------------------------------------------------------

export interface InputOptions {
  message: string
  default?: string
  /** Minimum required length. */
  minLength?: number
}

/** Single-line text input. */
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
// Boolean yes/no prompt.
// ---------------------------------------------------------------------------

export interface ConfirmOptions {
  message: string
  default?: boolean
}

/** Boolean yes/no confirm. */
export async function confirm(opts: ConfirmOptions): Promise<boolean> {
  return _confirm({
    message: opts.message,
    default: opts.default,
  })
}

// ---------------------------------------------------------------------------
// password
//
// Masked secret input. There is no dedicated hint field; callers that want a
// hint should fold it into the message.
// ---------------------------------------------------------------------------

export interface PasswordOptions {
  message: string
  /** Informational hint text — prepend to message or log separately. */
  hint?: string
}

/** Masked password/secret input. */
export async function password(opts: PasswordOptions): Promise<string> {
  return _password({
    message: opts.message,
    mask: "*",
  })
}
