# auth

> Manage Linear authentication

## Usage

```
Usage:   linear auth

Description:

  Manage Linear authentication

Options:

  -h, --help           - Show this help.                      
  --workspace  <slug>  - Target workspace (uses credentials)  

Commands:

  login                 - Add a workspace credential                     
  logout   [workspace]  - Remove a workspace credential                  
  list                  - List configured workspaces                     
  default  [workspace]  - Set the default workspace                      
  token                 - Print the configured API token                 
  whoami                - Print information about the authenticated user 
  status                - Show how auth resolves in the current directory 
```

## Subcommands

### login

> Add a workspace credential

```
Usage:   linear auth login

Description:

  Add a workspace credential

Options:

  -h, --help           - Show this help.                                              
  --workspace  <slug>  - Target workspace (uses credentials)                          
  -k, --key    <key>   - API key (prompted if not provided)                           
```

### logout

> Remove a workspace credential

```
Usage:   linear auth logout [workspace]

Description:

  Remove a workspace credential

Options:

  -h, --help           - Show this help.                      
  --workspace  <slug>  - Target workspace (uses credentials)  
  -f, --force          - Skip confirmation prompt
```

### list

> List configured workspaces

```
Usage:   linear auth list

Description:

  List configured workspaces

Options:

  -h, --help           - Show this help.                      
  --workspace  <slug>  - Target workspace (uses credentials)
```

### default

> Set the default workspace

```
Usage:   linear auth default [workspace]

Description:

  Set the default workspace

Options:

  -h, --help           - Show this help.                      
  --workspace  <slug>  - Target workspace (uses credentials)
```

### token

> Print the configured API token

```
Usage:   linear auth token

Description:

  Print the configured API token

Options:

  -h, --help           - Show this help.                      
  --workspace  <slug>  - Target workspace (uses credentials)
```

### whoami

> Print information about the authenticated user

```
Usage:   linear auth whoami

Description:

  Print information about the authenticated user

Options:

  -h, --help           - Show this help.                      
  --workspace  <slug>  - Target workspace (uses credentials)
```

### status

> Show how auth resolves in the current directory

```
Usage:   linear auth status

Description:

  Show how auth resolves in the current directory

Options:

  -h, --help           - Show this help.                      
  --workspace  <slug>  - Target workspace (uses credentials)
```
