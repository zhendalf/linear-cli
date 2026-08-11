# milestone

> 

## Usage

```
Usage: linear milestone|m [options] [command]

Manage Linear project milestones

Options:
  --workspace <slug>              Target workspace (uses credentials)
  -h, --help                      display help for command

Commands:
  list [options]                  List milestones for a project
  view|v [options] <milestoneId>  View milestone details. By default lists the
                                  first 10 attached issues from the first page
                                  of 50; use --all to paginate the full set.
  create [options]                Create a new project milestone
  update [options] <id>           Update an existing project milestone
  delete [options] <id>           Delete a project milestone
```

## Subcommands

### list

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

```
Usage: linear milestone view|v [options] <milestoneId>

View milestone details. By default lists the first 10 attached issues from the
first page of 50; use --all to paginate the full set.

Arguments:
  milestoneId         Milestone ID

Options:
  --all               Fetch and list every issue attached to the milestone
                      (paginates the Linear API)
  --no-pager          Disable automatic paging for long output
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### create

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
