import { Command } from "commander"
import {
  buildClientSchema,
  getIntrospectionQuery,
  type IntrospectionQuery,
  lexicographicSortSchema,
  printSchema,
} from "graphql"
import { writeFile } from "node:fs/promises"
import { handleError } from "../utils/errors.ts"
import { getGraphQLClient } from "../utils/graphql.ts"

export const schemaCommand = new Command("schema")
  .description("Print the GraphQL schema to stdout")
  .option("--json", "Output as JSON introspection result instead of SDL")
  .option(
    "-o, --output <file>",
    "Write schema to file instead of stdout",
  )
  .action(async (options) => {
    try {
      const { json, output } = options

      const client = getGraphQLClient()
      const introspectionQuery = getIntrospectionQuery()
      const result = await client.request<IntrospectionQuery>(
        introspectionQuery,
      )

      let content: string
      if (json) {
        content = JSON.stringify(result, null, 2)
      } else {
        const schema = lexicographicSortSchema(buildClientSchema(result))
        content = printSchema(schema)
      }

      if (output) {
        await writeFile(output, content + "\n", "utf8")
        console.log(`Schema written to ${output}`)
      } else {
        console.log(content)
      }
    } catch (error) {
      handleError(error, "Failed to fetch schema")
    }
  })
