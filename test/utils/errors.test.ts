import { expect, test } from "bun:test"
import { ClientError, type GraphQLResponse } from "graphql-request"
import {
  CliError,
  NotFoundError,
  ValidationError,
  extractGraphQLMessage,
  isClientError,
  isDebugMode,
  isNotFoundError,
} from "../../src/utils/errors.ts"

test("isDebugMode - returns false when LINEAR_DEBUG is not set", () => {
  delete process.env["LINEAR_DEBUG"]
  expect(isDebugMode()).toBe(false)
})

test("isDebugMode - returns true when LINEAR_DEBUG is '1'", () => {
  process.env["LINEAR_DEBUG"] = "1"
  try {
    expect(isDebugMode()).toBe(true)
  } finally {
    delete process.env["LINEAR_DEBUG"]
  }
})

test("isDebugMode - returns true when LINEAR_DEBUG is 'true'", () => {
  process.env["LINEAR_DEBUG"] = "true"
  try {
    expect(isDebugMode()).toBe(true)
  } finally {
    delete process.env["LINEAR_DEBUG"]
  }
})

test("CliError - stores user message", () => {
  const error = new CliError("Something went wrong")
  expect(error.userMessage).toBe("Something went wrong")
  expect(error.message).toBe("Something went wrong")
})

test("CliError - stores suggestion", () => {
  const error = new CliError("Something went wrong", {
    suggestion: "Try running with --force",
  })
  expect(error.suggestion).toBe("Try running with --force")
})

test("NotFoundError - formats message correctly", () => {
  const error = new NotFoundError("Issue", "ENG-123")
  expect(error.userMessage).toBe("Issue not found: ENG-123")
  expect(error.entityType).toBe("Issue")
  expect(error.identifier).toBe("ENG-123")
})

test("ValidationError - stores message and suggestion", () => {
  const error = new ValidationError("Invalid relation type: foo", {
    suggestion: "Must be one of: blocks, related",
  })
  expect(error.userMessage).toBe("Invalid relation type: foo")
  expect(error.suggestion).toBe("Must be one of: blocks, related")
})

// Helper to create test ClientError instances
function createClientError(message: string, userPresentableMessage?: string): ClientError {
  const response = {
    status: 200,
    errors: [
      {
        message,
        extensions: userPresentableMessage ? { userPresentableMessage } : undefined,
      },
    ],
  } as unknown as GraphQLResponse<unknown>
  return new ClientError(response, { query: "query {}" })
}

test("extractGraphQLMessage - extracts userPresentableMessage", () => {
  const error = createClientError("Internal error", "Issue not found")
  expect(extractGraphQLMessage(error)).toBe("Issue not found")
})

test("extractGraphQLMessage - falls back to error message", () => {
  const error = createClientError("Entity not found: Issue")
  expect(extractGraphQLMessage(error)).toBe("Entity not found: Issue")
})

test("isNotFoundError - returns true for 'not found' messages", () => {
  const error = createClientError("Entity not found: Issue")
  expect(isNotFoundError(error)).toBe(true)
})

test("isNotFoundError - returns false for other errors", () => {
  const error = createClientError("Authentication required")
  expect(isNotFoundError(error)).toBe(false)
})

test("isClientError - returns true for ClientError", () => {
  const error = createClientError("Some error")
  expect(isClientError(error)).toBe(true)
})

test("isClientError - returns false for other errors", () => {
  const error = new Error("Some error")
  expect(isClientError(error)).toBe(false)
})
