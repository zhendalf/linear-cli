# initiative-update

> 

## Usage

```
Usage: linear initiative-update|iu [options] [command]

Manage initiative status updates (timeline posts)

Options:
  --workspace <slug>                 Target workspace (uses credentials)
  -h, --help                         display help for command

Commands:
  create|c [options] <initiativeId>  Create a new status update for an
                                     initiative
  list|l [options] <initiativeId>    List status updates for an initiative
```

## Subcommands

### create

```
Usage: linear initiative-update create|c [options] <initiativeId>

Create a new status update for an initiative

Options:
  --body <body>       Update content (markdown)
  --body-file <path>  Read content from file
  --health <health>   Health status (onTrack, atRisk, offTrack)
  -i, --interactive   Interactive mode with prompts
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### list

```
Usage: linear initiative-update list|l [options] <initiativeId>

List status updates for an initiative

Options:
  -j, --json          Output as JSON
  --limit <limit>     Limit results (default: 10)
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
