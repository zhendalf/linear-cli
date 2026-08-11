# cycle

> Manage Linear team cycles

## Usage

```
Usage: linear cycle|cy [options] [command]

Manage Linear team cycles

Options:
  --workspace <slug>           Target workspace (uses credentials)
  -h, --help                   display help for command

Commands:
  list [options]               List cycles for a team
  view|v [options] <cycleRef>  View cycle details
```

## Subcommands

### list

> List cycles for a team

```
Usage: linear cycle list [options]

List cycles for a team

Options:
  --team <team>       Team key (defaults to current team)
  -j, --json          Output as JSON
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### view

> View cycle details

```
Usage: linear cycle view|v [options] <cycleRef>

View cycle details

Arguments:
  cycleRef            Cycle reference (name or number)

Options:
  --team <team>       Team key (defaults to current team)
  --no-pager          Disable automatic paging for long output
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
