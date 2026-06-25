import { expect, test } from "bun:test"
import { getGraphQLClient } from "../src/utils/graphql.ts"

// Mock fetch function for testing
const originalFetch = globalThis.fetch

function mockFetch(response: Response) {
  globalThis.fetch = () => Promise.resolve(response)
}

function restoreFetch() {
  globalThis.fetch = originalFetch
}

test("getGraphQLClient handles authentication errors", async () => {
  const jsonErrorResponse = {
    errors: [
      {
        message: "Authentication failed",
        extensions: {
          code: "INVALID_API_KEY",
        },
      },
    ],
  }

  const mockResponse = new Response(JSON.stringify(jsonErrorResponse), {
    status: 401,
    statusText: "Unauthorized",
    headers: {
      "content-type": "application/json",
    },
  })

  mockFetch(mockResponse)
  process.env["LINEAR_API_KEY"] = "test-api-key"

  try {
    const client = getGraphQLClient()
    await client.request("query { viewer { id } }", {})
    throw new Error("Expected GraphQL client to throw an error")
  } catch (error) {
    const errorMessage = (error as Error).message
    expect(errorMessage).toContain("Authentication failed")
  } finally {
    restoreFetch()
    delete process.env["LINEAR_API_KEY"]
  }
})

test("getGraphQLClient handles HTTP errors", async () => {
  const htmlErrorResponse = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>500 Internal Server Error</title>
    </head>
    <body>
        <h1>Internal Server Error</h1>
        <p>The server encountered an unexpected condition that prevented it from fulfilling the request.</p>
        <p>Error ID: abc123def456</p>
    </body>
    </html>
  `.trim()

  const mockResponse = new Response(htmlErrorResponse, {
    status: 500,
    statusText: "Internal Server Error",
    headers: {
      "content-type": "text/html",
    },
  })

  mockFetch(mockResponse)
  process.env["LINEAR_API_KEY"] = "test-api-key"

  try {
    const client = getGraphQLClient()
    await client.request("query { viewer { id } }", {})
    throw new Error("Expected GraphQL client to throw an error")
  } catch (error) {
    const errorMessage = (error as Error).message
    expect(errorMessage.toLowerCase()).toContain("500")
  } finally {
    restoreFetch()
    delete process.env["LINEAR_API_KEY"]
  }
})

test("getGraphQLClient handles malformed JSON responses", async () => {
  const malformedJsonResponse = '{"error": "Invalid JSON", "incomplete": '

  const mockResponse = new Response(malformedJsonResponse, {
    status: 400,
    statusText: "Bad Request",
    headers: {
      "content-type": "application/json",
    },
  })

  mockFetch(mockResponse)
  process.env["LINEAR_API_KEY"] = "test-api-key"

  try {
    const client = getGraphQLClient()
    await client.request("query { viewer { id } }", {})
    throw new Error("Expected GraphQL client to throw an error")
  } catch (error) {
    const errorMessage = (error as Error).message
    expect(errorMessage.toLowerCase()).toContain("400")
  } finally {
    restoreFetch()
    delete process.env["LINEAR_API_KEY"]
  }
})
