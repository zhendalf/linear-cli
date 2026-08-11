import type { CodegenConfig } from "@graphql-codegen/cli"

const config: CodegenConfig = {
  schema: "graphql/schema.graphql",
  documents: ["src/**/*.ts"],
  generates: {
    "src/__codegen__/": {
      preset: "client",
      plugins: [],
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        // graphql-codegen >= 6 types unconfigured custom scalars as `unknown`;
        // map Linear's scalars to their real wire types (ISO strings etc.).
        // strictScalars makes codegen fail loudly if the schema adds a scalar
        // that isn't mapped here.
        strictScalars: true,
        scalars: {
          DateTime: "string",
          DateTimeOrDuration: "string",
          Duration: "string",
          JSON: "unknown",
          JSONObject: "Record<string, unknown>",
          TimelessDate: "string",
          TimelessDateOrDuration: "string",
          UUID: "string",
        },
      },
      presetConfig: {
        gqlTagName: "gql",
        fragmentMasking: false,
      },
    },
  },
}

export default config
