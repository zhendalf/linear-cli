/**
 * Mock Linear API server for testing, built on node:http.
 */

import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http"

interface MockResponse {
  queryName: string
  queryIncludes?: string
  variables?: Record<string, unknown>
  response: Record<string, unknown>
  status?: number
}

export class MockLinearServer {
  private server?: Server
  private port = 0
  private mockResponses: MockResponse[]
  // Remembers LINEAR_GRAPHQL_ENDPOINT prior to start() so stop() can restore it.
  // `false` = not currently overriding; otherwise the saved previous value
  // (`undefined` means the var was unset before we touched it).
  private prevEndpoint: string | undefined | false = false

  constructor(responses: MockResponse[] = []) {
    this.mockResponses = responses
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          })
          res.end()
          return
        }

        // Handle GraphQL requests
        const url = new URL(req.url ?? "/", `http://localhost`)
        if (req.method === "POST" && url.pathname === "/graphql") {
          this.handleGraphQL(req, res)
          return
        }

        res.writeHead(404)
        res.end("Not Found")
      })

      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address()
        if (addr && typeof addr === "object") {
          this.port = addr.port
        }
        // Save the prior value so stop() can restore it, then point the GraphQL
        // client at this server.
        this.prevEndpoint = process.env["LINEAR_GRAPHQL_ENDPOINT"]
        process.env["LINEAR_GRAPHQL_ENDPOINT"] = this.getEndpoint()
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    // Restore LINEAR_GRAPHQL_ENDPOINT to whatever it was before start().
    if (this.prevEndpoint !== false) {
      if (this.prevEndpoint === undefined) {
        delete process.env["LINEAR_GRAPHQL_ENDPOINT"]
      } else {
        process.env["LINEAR_GRAPHQL_ENDPOINT"] = this.prevEndpoint
      }
      this.prevEndpoint = false
    }

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = undefined
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  getEndpoint(): string {
    return `http://127.0.0.1:${this.port}/graphql`
  }

  private handleGraphQL(req: IncomingMessage, res: ServerResponse): void {
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      Date: "Mon, 01 Jan 2024 00:00:00 GMT",
    }

    let body = ""
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString()
    })

    req.on("end", () => {
      try {
        const { query, variables } = JSON.parse(body)
        const mockResponse = this.findMatchingResponse(query, variables)

        if (mockResponse) {
          res.writeHead(mockResponse.status ?? 200, headers)
          res.end(JSON.stringify(mockResponse.response))
          return
        }

        // Default response for unhandled queries
        res.writeHead(200, headers)
        res.end(
          JSON.stringify({
            errors: [
              {
                message: "No mock response configured for this query",
                extensions: {
                  code: "NO_MOCK_CONFIGURED",
                  query: this.extractQueryName(query),
                  variables,
                },
              },
            ],
          }),
        )
      } catch {
        res.writeHead(400, headers)
        res.end(
          JSON.stringify({
            errors: [
              {
                message: "Invalid JSON in request body",
                extensions: { code: "BAD_REQUEST" },
              },
            ],
          }),
        )
      }
    })
  }

  private findMatchingResponse(
    query: string,
    variables: Record<string, unknown> = {},
  ): MockResponse | undefined {
    const queryName = this.extractQueryName(query)

    return this.mockResponses.find((mock) => {
      if (mock.queryName !== queryName) return false
      if (mock.queryIncludes != null && !query.includes(mock.queryIncludes)) {
        return false
      }
      if (!mock.variables) return true
      return Object.entries(mock.variables).every(([key, value]) =>
        this.deepEqual(variables[key], value),
      )
    })
  }

  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a == null || b == null) return a === b
    if (typeof a !== typeof b) return false
    if (typeof a !== "object") return a === b
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    const aKeys = Object.keys(aObj)
    const bKeys = Object.keys(bObj)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key) => this.deepEqual(aObj[key], bObj[key]))
  }

  private extractQueryName(query: string): string {
    const match = query.match(/(?:query|mutation)\s+(\w+)/)
    return match?.[1] || "UnknownQuery"
  }

  addResponse(response: MockResponse): void {
    this.mockResponses.push(response)
  }

  clearResponses(): void {
    this.mockResponses = []
  }
}
