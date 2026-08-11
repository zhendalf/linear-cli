# team

> 

## Usage

```
Usage: linear team|t [options] [command]

Manage Linear teams

Options:
  --workspace <slug>           Target workspace (uses credentials)
  -h, --help                   display help for command

Commands:
  create [options]             Create a linear team
  delete [options] <teamKey>   Delete a Linear team
  list [options]               List teams
  id [options]                 Print the configured team id
  autolinks [options]          Configure GitHub repository autolinks for Linear
                               issues with this team prefix
  members [options] [teamKey]  List team members
```

## Subcommands

### create

```
Usage: linear team create [options]

Create a linear team

Options:
  -n, --name <name>                Name of the team
  -d, --description <description>  Description of the team
  -k, --key <key>                  Team key (if not provided, will be generated
                                   from name)
  --private                        Make the team private
  --no-interactive                 Disable interactive prompts
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command
```

### delete

```
Usage: linear team delete [options] <teamKey>

Delete a Linear team

Arguments:
  teamKey                     Team key to delete

Options:
  --move-issues <targetTeam>  Move all issues to another team before deletion
  -y, --yes                   Skip confirmation prompt
  --workspace <slug>          Target workspace (uses credentials)
  -h, --help                  display help for command
```

### list

```
Usage: linear team list [options]

List teams

Options:
  -w, --web           Open in web browser
  -a, --app           Open in Linear.app
  -j, --json          Output as JSON
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### id

```
Usage: linear team id [options]

Print the configured team id

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### autolinks

```
Usage: linear team autolinks [options]

Configure GitHub repository autolinks for Linear issues with this team prefix

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### members

```
Usage: linear team members [options] [teamKey]

List team members

Arguments:
  teamKey             Team key

Options:
  -a, --all           Include inactive members
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
