# authentication

the CLI supports multiple authentication methods with the following precedence:

1. `LINEAR_API_KEY` environment variable
2. `api_key` in the project `.linear.toml` config
3. `--workspace` flag → stored credentials lookup
4. project's `workspace` config → stored credentials lookup
5. default workspace from stored credentials

> **Note:** `LINEAR_API_KEY` and `--workspace` are mutually exclusive. If
> `LINEAR_API_KEY` is set (e.g. in your shell or CI) and you also pass
> `--workspace`, the CLI errors rather than silently preferring one — unset
> `LINEAR_API_KEY` or drop `--workspace`.

## stored credentials (recommended)

API keys are stored in `~/.config/linear/credentials.json` with `0600`
permissions (owner read/write only). On Windows the file lives under
`%APPDATA%\linear\Config\credentials.json`. The location honors
`XDG_CONFIG_HOME` when set.

The file is plain JSON: the special `default` key names the active workspace
and every other key maps a workspace slug to its API key.

```json
{
  "default": "acme",
  "acme": "lin_api_...",
  "side-project": "lin_api_..."
}
```

> **Migrating from the original Deno release:** earlier versions stored tokens in
> the OS keyring (macOS Keychain, libsecret, Windows Credential Manager). That
> keyring backend has been removed. After upgrading you must re-run
> `linear auth login` for each workspace to populate `credentials.json`.

### commands

```bash
linear auth login              # add a workspace (prompts for API key)
linear auth login --key <key>  # add with key directly (for scripts)
linear auth list               # list configured workspaces
linear auth status             # show auth resolution for the current directory
linear auth default            # interactively set the default workspace
linear auth default <slug>     # set the default workspace directly
linear auth logout <slug>      # remove a workspace
linear auth logout <slug> -f   # remove without confirmation
linear auth whoami             # show current user and workspace
linear auth token              # print the resolved API key
```

### adding workspaces

```bash
# the first workspace becomes the default
$ linear auth login
Enter your Linear API key: ***
Logged in to workspace: Acme Corp (acme)
  User: Jane Developer <jane@acme.com>
  Set as default workspace

# add additional workspaces
$ linear auth login
Enter your Linear API key: ***
Logged in to workspace: Side Project (side-project)
  User: Jane Developer <jane@example.com>
```

### listing workspaces

```bash
$ linear auth list
  WORKSPACE    ORG NAME      USER
* acme         Acme Corp     Jane Developer <jane@acme.com>
  side-project Side Project  Jane Developer <jane@example.com>
```

the `*` indicates the default workspace.

### switching workspaces

```bash
# set a new default
linear auth default side-project

# or use the --workspace flag for a single command
linear --workspace side-project issue list
linear --workspace acme issue create --title "Bug fix"
```

## environment variable

for CI or simple setups, set an environment variable:

```sh
# bash/zsh
export LINEAR_API_KEY="lin_api_..."

# fish
set -Ux LINEAR_API_KEY "lin_api_..."
```

this takes precedence over stored credentials. if `LINEAR_API_KEY` is set and
you run `linear auth login`, the CLI warns you that the env var will shadow the
stored credentials.

## project config

you can also set the API key in a project's `.linear.toml`:

```toml
api_key = "lin_api_..."
workspace = "acme"
team_id = "ENG"
```

this is convenient for project-specific credentials but less secure than stored
credentials, since the file may be committed to version control.

## workspace matching

when your project config sets a `workspace`:

```toml
# .linear.toml
workspace = "acme"
team_id = "ENG"
```

the CLI automatically uses the stored credentials for that workspace, even if a
different workspace is your global default. this lets you work across multiple
projects with different workspaces without switching the default each time.

## creating an API key

1. go to [linear.app/settings/account/security](https://linear.app/settings/account/security)
2. scroll to "Personal API keys"
3. click "Create key"
4. give it a label (e.g. "CLI")
5. copy the key (starts with `lin_api_`)

note: creating an API key requires member access; it is not available for guest
accounts.
