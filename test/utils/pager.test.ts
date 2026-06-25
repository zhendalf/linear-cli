import { expect, test } from "bun:test"
import { getPagerCommand, shouldUsePager } from "../../src/utils/pager.ts"

test("shouldUsePager - returns false when usePager is false", () => {
  const outputLines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`)
  expect(shouldUsePager(outputLines, false)).toBe(false)
})

test("shouldUsePager - returns false when not in terminal", () => {
  const origIsTTY = process.stdout.isTTY
  Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true })

  try {
    const outputLines = Array.from(
      { length: 100 },
      (_, i) => `Line ${i + 1}`,
    )
    expect(shouldUsePager(outputLines, true)).toBe(false)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
  }
})

test("shouldUsePager - returns true when content is long and conditions are met", () => {
  const origIsTTY = process.stdout.isTTY
  const origRows = process.stdout.rows
  const origColumns = process.stdout.columns

  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  Object.defineProperty(process.stdout, "rows", { value: 10, configurable: true })
  Object.defineProperty(process.stdout, "columns", { value: 80, configurable: true })

  try {
    // Create output longer than terminal height (10 - 2 = 8)
    const outputLines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`)
    expect(shouldUsePager(outputLines, true)).toBe(true)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    Object.defineProperty(process.stdout, "rows", { value: origRows, configurable: true })
    Object.defineProperty(process.stdout, "columns", { value: origColumns, configurable: true })
  }
})

test("shouldUsePager - returns false when content is short", () => {
  const origIsTTY = process.stdout.isTTY
  const origRows = process.stdout.rows
  const origColumns = process.stdout.columns

  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  Object.defineProperty(process.stdout, "rows", { value: 50, configurable: true })
  Object.defineProperty(process.stdout, "columns", { value: 80, configurable: true })

  try {
    // Create output shorter than terminal height (50 - 2 = 48)
    const outputLines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`)
    expect(shouldUsePager(outputLines, true)).toBe(false)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    Object.defineProperty(process.stdout, "rows", { value: origRows, configurable: true })
    Object.defineProperty(process.stdout, "columns", { value: origColumns, configurable: true })
  }
})

test("getPagerCommand - includes -X flag for less on unix systems", () => {
  const originalPager = process.env["PAGER"]
  if (originalPager) delete process.env["PAGER"]

  try {
    const pagerConfig = getPagerCommand()
    if (process.platform !== "win32") {
      expect(pagerConfig?.command).toBe("less")
      expect(pagerConfig?.args).toEqual(["-R", "-X"])
    }
  } finally {
    if (originalPager) process.env["PAGER"] = originalPager
  }
})
