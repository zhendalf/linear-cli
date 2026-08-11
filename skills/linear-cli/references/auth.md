# auth

> Manage Linear authentication

## Usage

```
Usage: linear auth [options] [command]

Manage Linear authentication

Options:
  --workspace <slug>             Target workspace (uses credentials)
  -h, --help                     display help for command

Commands:
  login [options]                Add a workspace credential
  logout [options] [workspace]   Remove a workspace credential
  list [options]                 List configured workspaces
  default [options] [workspace]  Set the default workspace
  token [options]                Print the configured API token
  whoami [options]               Print information about the authenticated user
  status [options]               Print information about the authenticated user
```

## Subcommands

### login

> Add a workspace credential

```
Usage: linear auth login [options]

Add a workspace credential

Options:
  -k, --key <key>     API key (prompted if not provided)
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### logout

> Remove a workspace credential

```
Usage: linear auth logout [options] [workspace]

Remove a workspace credential

Arguments:
  workspace           Workspace slug to remove

Options:
  -y, --yes           Skip confirmation prompt
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### list

> List configured workspaces

```
Usage: linear auth list [options]

List configured workspaces

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### default

> Set the default workspace

```
Usage: linear auth default [options] [workspace]

Set the default workspace

Arguments:
  workspace           Workspace slug to set as default

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### token

> Print the configured API token

```
Usage: linear auth token [options]

Print the configured API token

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### whoami

> Print information about the authenticated user

```
Usage: linear auth whoami [options]

Print information about the authenticated user

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### status

> Print information about the authenticated user

```
Usage: linear auth status [options]

Print information about the authenticated user

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
