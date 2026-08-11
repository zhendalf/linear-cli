# project

> Manage Linear projects

## Usage

```
Usage: linear project|p [options] [command]

Manage Linear projects

Options:
  --workspace <slug>            Target workspace (uses credentials)
  -h, --help                    display help for command

Commands:
  list [options]                List projects
  view|v [options] <projectId>  View project details
  create [options]              Create a new Linear project
  update [options] <projectId>  Update a Linear project
  delete [options] <projectId>  Delete (trash) a Linear project
```

## Subcommands

### list

> List projects

```
Usage: linear project list [options]

List projects

Options:
  --team <team>       Filter by team key
  --all-teams         Show projects from all teams
  --status <status>   Filter by status name
  -w, --web           Open in web browser
  -a, --app           Open in Linear.app
  -j, --json          Output as JSON
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### view

> View project details

```
Usage: linear project view|v [options] <projectId>

View project details

Arguments:
  projectId           Project ID or slug

Options:
  -w, --web           Open in web browser
  -a, --app           Open in Linear.app
  --no-pager          Disable automatic paging for long output
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### create

> Create a new Linear project

```
Usage: linear project create [options]

Create a new Linear project

Options:
  -n, --name <name>                Project name (required)
  -d, --description <description>  Project description
  -t, --team <team>                Team key (can be repeated for multiple teams)
  -l, --lead <lead>                Project lead (username, email, or @me)
  -s, --status <status>            Project status (planned, started, paused,
                                   completed, canceled, backlog)
  --start-date <startDate>         Start date (YYYY-MM-DD)
  --target-date <targetDate>       Target completion date (YYYY-MM-DD)
  --initiative <initiative>        Add to initiative immediately (ID, slug, or
                                   name)
  -i, --interactive                Interactive mode (default if no flags
                                   provided)
  -j, --json                       Output created project as JSON
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command
```

### update

> Update a Linear project

```
Usage: linear project update [options] <projectId>

Update a Linear project

Arguments:
  projectId                        Project ID or slug

Options:
  -n, --name <name>                Project name
  -d, --description <description>  Project description
  -s, --status <status>            Status (planned, started, paused, completed,
                                   canceled, backlog)
  -l, --lead <lead>                Project lead (username, email, or @me)
  --start-date <startDate>         Start date (YYYY-MM-DD)
  --target-date <targetDate>       Target date (YYYY-MM-DD)
  -t, --team <team>                Team key (can be repeated for multiple teams)
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command
```

### delete

> Delete (trash) a Linear project

```
Usage: linear project delete [options] <projectId>

Delete (trash) a Linear project

Arguments:
  projectId           Project ID or slug

Options:
  -y, --yes           Skip confirmation prompt
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
