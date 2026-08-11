# project-update

> 

## Usage

```
Usage: linear project-update|pu [options] [command]

Manage project status updates

Options:
  --workspace <slug>              Target workspace (uses credentials)
  -h, --help                      display help for command

Commands:
  create|c [options] <projectId>  Create a new status update for a project
  list|l [options] <projectId>    List status updates for a project
```

## Subcommands

### create

```
Usage: linear project-update create|c [options] <projectId>

Create a new status update for a project

Arguments:
  projectId           Project ID or slug

Options:
  --body <body>       Update content (inline)
  --body-file <path>  Read content from file
  --health <health>   Project health status (onTrack, atRisk, offTrack)
  -i, --interactive   Interactive mode with prompts
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### list

```
Usage: linear project-update list|l [options] <projectId>

List status updates for a project

Arguments:
  projectId           Project ID or slug

Options:
  --json              Output as JSON
  --limit <limit>     Limit results (default: 10)
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
