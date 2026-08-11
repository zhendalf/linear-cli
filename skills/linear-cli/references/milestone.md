# milestone

> Manage Linear project milestones

## Usage

```
Usage: linear milestone|m [options] [command]

Manage Linear project milestones

Options:
  --workspace <slug>              Target workspace (uses credentials)
  -h, --help                      display help for command

Commands:
  list [options]                  List milestones for a project
  view|v [options] <milestoneId>  View milestone details
  create [options]                Create a new project milestone
  update [options] <id>           Update an existing project milestone
  delete [options] <id>           Delete a project milestone
```

## Subcommands

### list

> List milestones for a project

```
Usage: linear milestone list [options]

List milestones for a project

Options:
  --project <projectId>  Project ID
  -j, --json             Output as JSON
  --workspace <slug>     Target workspace (uses credentials)
  -h, --help             display help for command
```

### view

> View milestone details

```
Usage: linear milestone view|v [options] <milestoneId>

View milestone details

Arguments:
  milestoneId         Milestone ID

Options:
  --no-pager          Disable automatic paging for long output
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### create

> Create a new project milestone

```
Usage: linear milestone create [options]

Create a new project milestone

Options:
  --project <projectId>        Project ID
  --name <name>                Milestone name
  --description <description>  Milestone description
  --target-date <date>         Target date (YYYY-MM-DD)
  --workspace <slug>           Target workspace (uses credentials)
  -h, --help                   display help for command
```

### update

> Update an existing project milestone

```
Usage: linear milestone update [options] <id>

Update an existing project milestone

Arguments:
  id                           Milestone ID

Options:
  --name <name>                Milestone name
  --description <description>  Milestone description
  --target-date <date>         Target date (YYYY-MM-DD)
  --sort-order <value>         Sort order relative to other milestones
  --project <projectId>        Move to a different project
  --workspace <slug>           Target workspace (uses credentials)
  -h, --help                   display help for command
```

### delete

> Delete a project milestone

```
Usage: linear milestone delete [options] <id>

Delete a project milestone

Arguments:
  id                  Milestone ID

Options:
  -y, --yes           Skip confirmation prompt
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
