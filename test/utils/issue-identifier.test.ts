import { expect, test } from "bun:test"
import {
  findIssueIdentifierInText,
  getTeamKeyFromIssueIdentifier,
  normalizeIssueIdentifier,
  parseIssueIdentifier,
} from "../../src/utils/issue-identifier.ts"

// parseIssueIdentifier

test("parseIssueIdentifier - parses standard identifier", () => {
  const result = parseIssueIdentifier("ABC-123")
  expect(result).toEqual({
    identifier: "ABC-123",
    teamKey: "ABC",
    issueNumber: "123",
  })
})

test("parseIssueIdentifier - parses alphanumeric team key", () => {
  const result = parseIssueIdentifier("PLA4-16916")
  expect(result).toEqual({
    identifier: "PLA4-16916",
    teamKey: "PLA4",
    issueNumber: "16916",
  })
})

test("parseIssueIdentifier - normalizes team key to uppercase", () => {
  const result = parseIssueIdentifier("abc-123")
  expect(result).toEqual({
    identifier: "ABC-123",
    teamKey: "ABC",
    issueNumber: "123",
  })
})

test("parseIssueIdentifier - returns undefined for number starting with zero", () => {
  expect(parseIssueIdentifier("ABC-0123")).toBeUndefined()
})

test("parseIssueIdentifier - returns undefined for bare number", () => {
  expect(parseIssueIdentifier("123")).toBeUndefined()
})

test("parseIssueIdentifier - returns undefined for empty string", () => {
  expect(parseIssueIdentifier("")).toBeUndefined()
})

test("parseIssueIdentifier - returns undefined for text with identifier embedded", () => {
  // parseIssueIdentifier requires exact match, not search
  expect(parseIssueIdentifier("Fixes ABC-123")).toBeUndefined()
})

// findIssueIdentifierInText

test("findIssueIdentifierInText - finds identifier in bracket+url format", () => {
  const result = findIssueIdentifierInText(
    "[ABC-123](https://linear.app/workspace/issue/ABC-123/some-title)",
  )
  expect(result?.identifier).toBe("ABC-123")
})

test("findIssueIdentifierInText - finds alphanumeric team key in bracket format", () => {
  const result = findIssueIdentifierInText(
    "[PLA4-16916](https://linear.app/workspace/issue/PLA4-16916/some-title)",
  )
  expect(result?.identifier).toBe("PLA4-16916")
})

test("findIssueIdentifierInText - finds identifier in plain text", () => {
  const result = findIssueIdentifierInText("Fixes ABC-123")
  expect(result?.identifier).toBe("ABC-123")
})

test("findIssueIdentifierInText - finds identifier in branch name", () => {
  const result = findIssueIdentifierInText("feature/ABC-123-my-feature")
  expect(result?.identifier).toBe("ABC-123")
})

test("findIssueIdentifierInText - normalizes to uppercase", () => {
  const result = findIssueIdentifierInText("[abc-456](https://linear.app/...)")
  expect(result?.identifier).toBe("ABC-456")
})

test("findIssueIdentifierInText - returns undefined for empty string", () => {
  expect(findIssueIdentifierInText("")).toBeUndefined()
})

test("findIssueIdentifierInText - returns undefined when no identifier present", () => {
  expect(findIssueIdentifierInText("no issue here")).toBeUndefined()
})

// getTeamKeyFromIssueIdentifier

test("getTeamKeyFromIssueIdentifier - extracts team key", () => {
  expect(getTeamKeyFromIssueIdentifier("ENG-42")).toBe("ENG")
})

test("getTeamKeyFromIssueIdentifier - extracts alphanumeric team key", () => {
  expect(getTeamKeyFromIssueIdentifier("PLA4-16916")).toBe("PLA4")
})

test("getTeamKeyFromIssueIdentifier - returns undefined for invalid input", () => {
  expect(getTeamKeyFromIssueIdentifier("not-an-issue")).toBeUndefined()
  expect(getTeamKeyFromIssueIdentifier("ABC-0123")).toBeUndefined()
})

// normalizeIssueIdentifier

test("normalizeIssueIdentifier - uppercases team key", () => {
  expect(normalizeIssueIdentifier("abc-123")).toBe("ABC-123")
})

test("normalizeIssueIdentifier - returns undefined for invalid input", () => {
  expect(normalizeIssueIdentifier("not-valid")).toBeUndefined()
  expect(normalizeIssueIdentifier("ABC-0")).toBeUndefined()
})
