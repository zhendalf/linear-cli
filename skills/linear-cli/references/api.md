# api

> Make a raw GraphQL API request

## Usage

```
Usage: linear api [options] [query]

Make a raw GraphQL API request

Arguments:
  query                    GraphQL query string (use - to read from stdin)

Options:
  --variable <variable>    Variable in key=value format (coerces booleans,
                           numbers, null; @file reads from path)
  --variables-json <json>  JSON object of variables (merged with --variable,
                           which takes precedence)
  --paginate               Auto-paginate a single connection field using cursor
                           pagination
  --silent                 Suppress response output (exit code still reflects
                           errors)
  --workspace <slug>       Target workspace (uses credentials)
  -h, --help               display help for command
```
