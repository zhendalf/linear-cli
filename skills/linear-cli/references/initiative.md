# initiative

> 

## Usage

```
Usage: linear initiative|init [options] [command]

Manage Linear initiatives

Options:
  --workspace <slug>                               Target workspace (uses credentials)
  -h, --help                                       display help for command

Commands:
  list|ls [options]                                List initiatives
  view|v [options] <initiativeId>                  View initiative details
  create [options]                                 Create a new Linear initiative
  archive [options] [initiativeId]                 Archive a Linear initiative
  update [options] <initiativeId>                  Update a Linear initiative
  unarchive [options] <initiativeId>               Unarchive a Linear initiative
  delete [options] [initiativeId]                  Permanently delete a Linear initiative
  add-project [options] <initiative> <project>     Link a project to an initiative
  remove-project [options] <initiative> <project>  Unlink a project from an initiative
```

## Subcommands

### list

```
Usage: linear initiative list|ls [options]

List initiatives

Options:
  -s, --status <status>  Filter by status (active, planned, completed)
  --all-statuses         Show all statuses (default: active only)
  -o, --owner <owner>    Filter by owner (username or email)
  -w, --web              Open initiatives page in web browser
  -a, --app              Open initiatives page in Linear.app
  -j, --json             Output as JSON
  --archived             Include archived initiatives
  --workspace <slug>     Target workspace (uses credentials)
  -h, --help             display help for command
```

### view

```
Usage: linear initiative view|v [options] <initiativeId>

View initiative details

Options:
  -w, --web           Open in web browser
  -a, --app           Open in Linear.app
  -j, --json          Output as JSON
  --no-pager          Disable automatic paging for long output
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### create

```
Usage: linear initiative create [options]

Create a new Linear initiative

Options:
  -n, --name <name>                Initiative name (required)
  -d, --description <description>  Initiative description
  -s, --status <status>            Status: planned, active, completed (default:
                                   planned)
  -o, --owner <owner>              Owner (username, email, or @me for yourself)
  --target-date <targetDate>       Target completion date (YYYY-MM-DD)
  -c, --color <color>              Color hex code (e.g., #5E6AD2)
  --icon <icon>                    Icon name
  -i, --interactive                Interactive mode (default if no flags
                                   provided)
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command
```

### archive

```
Usage: linear initiative archive [options] [initiativeId]

Archive a Linear initiative

Options:
  -y, --yes           Skip confirmation prompt
  --bulk <ids...>     Archive multiple initiatives by ID, slug, or name
  --bulk-file <file>  Read initiative IDs from a file (one per line)
  --bulk-stdin        Read initiative IDs from stdin
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### update

```
Usage: linear initiative update [options] <initiativeId>

Update a Linear initiative

Options:
  -n, --name <name>                New name for the initiative
  -d, --description <description>  New description
  --status <status>                New status (planned, active, completed,
                                   paused)
  --owner <owner>                  New owner (username, email, or @me)
  --target-date <targetDate>       Target completion date (YYYY-MM-DD)
  --color <color>                  Initiative color (hex, e.g., #5E6AD2)
  --icon <icon>                    Initiative icon name
  -i, --interactive                Interactive mode for updates
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command
```

### unarchive

```
Usage: linear initiative unarchive [options] <initiativeId>

Unarchive a Linear initiative

Options:
  -y, --yes           Skip confirmation prompt
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### delete

```
Usage: linear initiative delete [options] [initiativeId]

Permanently delete a Linear initiative

Options:
  -y, --yes           Skip confirmation prompt
  --bulk <ids...>     Delete multiple initiatives by ID, slug, or name
  --bulk-file <file>  Read initiative IDs from a file (one per line)
  --bulk-stdin        Read initiative IDs from stdin
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### add-project

```
Usage: linear initiative add-project [options] <initiative> <project>

Link a project to an initiative

Options:
  --sort-order <sortOrder>  Sort order within initiative
  --workspace <slug>        Target workspace (uses credentials)
  -h, --help                display help for command
```

### remove-project

```
Usage: linear initiative remove-project [options] <initiative> <project>

Unlink a project from an initiative

Options:
  -y, --yes           Skip confirmation prompt
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
