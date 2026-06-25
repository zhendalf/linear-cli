import { MockLinearServer } from "./mock_linear_server.ts"

export async function setupMockLinearServer(
  mockResponses: Array<{
    queryName: string
    queryIncludes?: string
    variables?: Record<string, unknown>
    response: Record<string, unknown>
  }>,
  envVars?: Record<string, string>,
): Promise<{ server: MockLinearServer; cleanup: () => Promise<void> }> {
  const server = new MockLinearServer(mockResponses)
  await server.start()

  // start() already sets LINEAR_GRAPHQL_ENDPOINT
  process.env["LINEAR_API_KEY"] = "Bearer test-token"

  if (envVars) {
    for (const [key, value] of Object.entries(envVars)) {
      process.env[key] = value
    }
  }

  const cleanup = async () => {
    // server.stop() restores LINEAR_GRAPHQL_ENDPOINT to its pre-start() value.
    await server.stop()
    delete process.env["LINEAR_API_KEY"]
    if (envVars) {
      for (const key of Object.keys(envVars)) {
        delete process.env[key]
      }
    }
  }

  return { server, cleanup }
}
