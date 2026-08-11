# label

> 

## Usage

```
Usage: linear label|l [options] [command]

Manage Linear issue labels

Options:
  --workspace <slug>           Target workspace (uses credentials)
  -h, --help                   display help for command

Commands:
  list [options]               List issue labels
  create [options]             Create a new issue label
  delete [options] <nameOrId>  Delete an issue label
```

## Subcommands

### list

```
Usage: linear label list [options]

List issue labels

Options:
  --team <teamKey>  Filter by team (e.g., TC). Shows team-specific labels only.
  --workspace       Show only workspace-level labels (not team-specific)
  --all             Show all labels (both workspace and team)
  -j, --json        Output as JSON
  -h, --help        display help for command
```

### create

```
Usage: linear label create [options]

Create a new issue label

Options:
  -n, --name <name>                Label name (required)
  -c, --color <color>              Color hex code (e.g., #EB5757)
  -d, --description <description>  Label description
  -t, --team <teamKey>             Team key for team-specific label (omit for
                                   workspace label)
  -i, --interactive                Interactive mode (default if no flags
                                   provided)
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command
```

### delete

```
Usage: linear label delete [options] <nameOrId>

Delete an issue label

Arguments:
  nameOrId              Label name or ID

Options:
  -t, --team <teamKey>  Team key to disambiguate labels with same name
  -y, --yes             Skip confirmation prompt
  --workspace <slug>    Target workspace (uses credentials)
  -h, --help            display help for command
```
