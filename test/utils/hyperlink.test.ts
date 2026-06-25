import { expect, test } from "bun:test"
import {
  shouldEnableHyperlinks,
  shouldShowSpinner,
} from "../../src/utils/hyperlink.ts"

// Tests for shouldShowSpinner

test("shouldShowSpinner - returns false when NO_COLOR is set", () => {
  const origIsTTY = process.stdout.isTTY
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  const origNoColor = process.env["NO_COLOR"]
  process.env["NO_COLOR"] = "1"

  try {
    expect(shouldShowSpinner()).toBe(false)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    if (origNoColor != null) {
      process.env["NO_COLOR"] = origNoColor
    } else {
      delete process.env["NO_COLOR"]
    }
  }
})

test("shouldShowSpinner - returns false when stdout is not a terminal", () => {
  const origIsTTY = process.stdout.isTTY
  Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true })
  const origNoColor = process.env["NO_COLOR"]
  if (origNoColor != null) {
    delete process.env["NO_COLOR"]
  }

  try {
    expect(shouldShowSpinner()).toBe(false)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    if (origNoColor != null) {
      process.env["NO_COLOR"] = origNoColor
    }
  }
})

test("shouldShowSpinner - returns true when terminal and NO_COLOR not set", () => {
  const origIsTTY = process.stdout.isTTY
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  const origNoColor = process.env["NO_COLOR"]
  if (origNoColor != null) {
    delete process.env["NO_COLOR"]
  }

  try {
    expect(shouldShowSpinner()).toBe(true)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    if (origNoColor != null) {
      process.env["NO_COLOR"] = origNoColor
    }
  }
})

test("shouldShowSpinner - returns false when NO_COLOR is empty string", () => {
  const origIsTTY = process.stdout.isTTY
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  const origNoColor = process.env["NO_COLOR"]
  process.env["NO_COLOR"] = ""

  try {
    expect(shouldShowSpinner()).toBe(false)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    if (origNoColor != null) {
      process.env["NO_COLOR"] = origNoColor
    } else {
      delete process.env["NO_COLOR"]
    }
  }
})

// Tests for shouldEnableHyperlinks

test("shouldEnableHyperlinks - returns false when NO_COLOR is set", () => {
  const origIsTTY = process.stdout.isTTY
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  const origNoColor = process.env["NO_COLOR"]
  process.env["NO_COLOR"] = "1"

  try {
    expect(shouldEnableHyperlinks()).toBe(false)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    if (origNoColor != null) {
      process.env["NO_COLOR"] = origNoColor
    } else {
      delete process.env["NO_COLOR"]
    }
  }
})

test("shouldEnableHyperlinks - returns false when stdout is not a terminal", () => {
  const origIsTTY = process.stdout.isTTY
  Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true })
  const origNoColor = process.env["NO_COLOR"]
  if (origNoColor != null) {
    delete process.env["NO_COLOR"]
  }

  try {
    expect(shouldEnableHyperlinks()).toBe(false)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    if (origNoColor != null) {
      process.env["NO_COLOR"] = origNoColor
    }
  }
})

test("shouldEnableHyperlinks - returns true when terminal and NO_COLOR not set", () => {
  const origIsTTY = process.stdout.isTTY
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true })
  const origNoColor = process.env["NO_COLOR"]
  if (origNoColor != null) {
    delete process.env["NO_COLOR"]
  }

  try {
    expect(shouldEnableHyperlinks()).toBe(true)
  } finally {
    Object.defineProperty(process.stdout, "isTTY", { value: origIsTTY, configurable: true })
    if (origNoColor != null) {
      process.env["NO_COLOR"] = origNoColor
    }
  }
})
