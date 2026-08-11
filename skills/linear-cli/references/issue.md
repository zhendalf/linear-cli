# issue

> Manage Linear issues

## Usage

```
Usage: linear issue|i [options] [command]

Manage Linear issues

Options:
  --workspace <slug>                     Target workspace (uses credentials)
  -h, --help                             display help for command

Commands:
  id [options]                           Print the issue based on the current git branch
  mine|list [options]                    List your issues
  query|q [options]                      Query issues with structured filters
  title [options] [issueId]              Print the issue title
  start [options] [issueId]              Start working on an issue
  view|v [options] [issueId]             View issue details (default) or open in browser/app
  url [options] [issueId]                Print the issue URL
  describe [options] [issueId]           Print the issue title and Linear-issue trailer
  commits [options] [issueId]            Show all commits for a Linear issue (jj only)
  pull-request|pr [options] [issueId]    Create a GitHub pull request with issue details
  delete|d [options] [issueId]           Delete an issue
  create [options]                       Create a linear issue
  update [options] [issueId]             Update a linear issue
  archive [options] [issueId]            Archive an issue
  unarchive [options] [issueId]          Unarchive an issue
  comment [options]                      Manage issue comments
  attach [options] <issueId> <filepath>  Attach a file to an issue
  link [options] <urlOrIssueId> [url]    Link a URL to an issue
  relation [options]                     Manage issue relations (dependencies)
  agent-session [options]                Manage agent sessions for an issue
```

## Subcommands

### id

> Print the issue based on the current git branch

```
Usage: linear issue id [options]

Print the issue based on the current git branch

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### mine

> List your issues

```
Usage: linear issue mine|list [options]

List your issues

Options:
  -s, --state <state>             Filter by issue state (can be repeated for
                                  multiple states)
  --all-states                    Show issues from all states
  --sort <sort>                   Sort order (can also be set via
                                  LINEAR_ISSUE_SORT) (choices: "manual",
                                  "priority")
  --team <team>                   Team to list issues for (if not your default
                                  team)
  --project <project>             Filter by project name
  --project-label <projectLabel>  Filter by project label name (shows issues
                                  from all projects with this label)
  --cycle <cycle>                 Filter by cycle name, number, or 'active'
  --milestone <milestone>         Filter by project milestone name (requires
                                  --project)
  -l, --label <label>             Filter by label name (can be repeated for
                                  multiple labels)
  --limit <n>                     Maximum number of issues to fetch (default:
                                  50, use 0 for unlimited) (default: 50)
  --created-after <date>          Filter issues created after this date (ISO
                                  8601 or YYYY-MM-DD)
  --updated-after <date>          Filter issues updated after this date (ISO
                                  8601 or YYYY-MM-DD)
  -w, --web                       Open in web browser
  -a, --app                       Open in Linear.app
  --no-pager                      Disable automatic paging for long output
  --workspace <slug>              Target workspace (uses credentials)
  -h, --help                      display help for command
```

### query

> Query issues with structured filters

```
Usage: linear issue query|q [options]

Query issues with structured filters

Options:
  --search <term>                 Full-text search term
  --search-comments               Also search inside issue comments (requires
                                  --search)
  --team <team>                   Filter by team key (can be repeated for
                                  multiple teams)
  --all-teams                     Query across all teams
  -s, --state <state>             Filter by issue state (can be repeated for
                                  multiple states)
  --all-states                    Show issues from all states (this is the
                                  default)
  --assignee <assignee>           Filter by assignee (username)
  -A, --all-assignees             Show issues for all assignees (this is the
                                  default)
  -U, --unassigned                Show only unassigned issues
  --sort <sort>                   Sort order: manual or priority (default:
                                  priority, not available with --search)
                                  (choices: "manual", "priority")
  --project <project>             Filter by project name
  --project-label <projectLabel>  Filter by project label name (shows issues
                                  from all projects with this label)
  --cycle <cycle>                 Filter by cycle name, number, or 'active'
  --milestone <milestone>         Filter by project milestone name (requires
                                  --project)
  -l, --label <label>             Filter by label name (can be repeated for
                                  multiple labels)
  --limit <n>                     Maximum number of issues to fetch (default:
                                  50, use 0 for unlimited) (default: 50)
  --created-after <date>          Filter issues created after this date (ISO
                                  8601 or YYYY-MM-DD)
  --updated-after <date>          Filter issues updated after this date (ISO
                                  8601 or YYYY-MM-DD)
  --include-archived              Include archived issues
  -j, --json                      Output results as JSON
  --no-pager                      Disable automatic paging for long output
  --workspace <slug>              Target workspace (uses credentials)
  -h, --help                      display help for command
```

### title

> Print the issue title

```
Usage: linear issue title [options] [issueId]

Print the issue title

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### start

> Start working on an issue

```
Usage: linear issue start [options] [issueId]

Start working on an issue

Options:
  -A, --all-assignees       Show issues for all assignees
  -U, --unassigned          Show only unassigned issues
  -f, --from-ref <fromRef>  Git ref to create new branch from
  -b, --branch <branch>     Custom branch name to use instead of the issue
                            identifier
  --workspace <slug>        Target workspace (uses credentials)
  -h, --help                display help for command
```

### view

> View issue details (default) or open in browser/app

```
Usage: linear issue view|v [options] [issueId]

View issue details (default) or open in browser/app

Options:
  -w, --web                Open in web browser
  -a, --app                Open in Linear.app
  --no-comments            Exclude comments from the output
  --show-resolved-threads  Include resolved comment threads in the output
  --no-pager               Disable automatic paging for long output
  -j, --json               Output issue data as JSON
  --no-download            Keep remote URLs instead of downloading files
  --workspace <slug>       Target workspace (uses credentials)
  -h, --help               display help for command
```

### url

> Print the issue URL

```
Usage: linear issue url [options] [issueId]

Print the issue URL

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### describe

> Print the issue title and Linear-issue trailer

```
Usage: linear issue describe [options] [issueId]

Print the issue title and Linear-issue trailer

Options:
  -r, --references    Use 'References' instead of 'Fixes' for the Linear issue
                      link
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### commits

> Show all commits for a Linear issue (jj only)

```
Usage: linear issue commits [options] [issueId]

Show all commits for a Linear issue (jj only)

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### pull-request

> Create a GitHub pull request with issue details

```
Usage: linear issue pull-request|pr [options] [issueId]

Create a GitHub pull request with issue details

Options:
  --base <branch>      The branch into which you want your code merged
  --draft              Create the pull request as a draft
  -t, --title <title>  Optional title for the pull request (Linear issue ID will
                       be prefixed)
  --web                Open the pull request in the browser after creating it
  --head <branch>      The branch that contains commits for your pull request
  --workspace <slug>   Target workspace (uses credentials)
  -h, --help           display help for command
```

### delete

> Delete an issue

```
Usage: linear issue delete|d [options] [issueId]

Delete an issue

Options:
  -y, --yes           Skip confirmation prompt
  --bulk <ids...>     Delete multiple issues by identifier (e.g., TC-123 TC-124)
  --bulk-file <file>  Read issue identifiers from a file (one per line)
  --bulk-stdin        Read issue identifiers from stdin
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### create

> Create a linear issue

```
Usage: linear issue create [options]

Create a linear issue

Options:
  --start                          Start the issue after creation
  -a, --assignee <assignee>        Assign the issue to 'self' or someone (by
                                   username or name)
  --due-date <dueDate>             Due date of the issue
  --parent <parent>                Parent issue (if any) as a team_number code
  -p, --priority <priority>        Priority of the issue (1-4, descending
                                   priority)
  --estimate <estimate>            Points estimate of the issue
  -d, --description <description>  Description of the issue
  --description-file <path>        Read description from a file (preferred for
                                   markdown content)
  -l, --label <label>              Issue label associated with the issue. May be
                                   repeated.
  --team <team>                    Team associated with the issue (if not your
                                   default team)
  --project <project>              Name or slug ID of the project with the issue
  -s, --state <state>              Workflow state for the issue (by name or
                                   type)
  --milestone <milestone>          Name of the project milestone
  --cycle <cycle>                  Cycle name, number, or 'active'
  --no-use-default-template        Do not use default template for the issue
  --no-interactive                 Disable interactive prompts
  -t, --title <title>              Title of the issue
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command
```

### update

> Update a linear issue

```
Usage: linear issue update [options] [issueId]

Update a linear issue

Options:
  -a, --assignee <assignee>        Assign the issue to 'self' or someone (by
                                   username or name)
  --due-date <dueDate>             Due date of the issue
  --parent <parent>                Parent issue (if any) as a team_number code
  -p, --priority <priority>        Priority of the issue (1-4, descending
                                   priority)
  --estimate <estimate>            Points estimate of the issue
  -d, --description <description>  Description of the issue
  --description-file <path>        Read description from a file (preferred for
                                   markdown content)
  -l, --label <label>              Issue label associated with the issue. May be
                                   repeated.
  --team <team>                    Team associated with the issue (if not your
                                   default team)
  --project <project>              Name or slug ID of the project with the issue
  -s, --state <state>              Workflow state for the issue (by name or
                                   type)
  --milestone <milestone>          Name of the project milestone
  --cycle <cycle>                  Cycle name, number, or 'active'
  -t, --title <title>              Title of the issue
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command
```

### archive

> Archive an issue

```
Usage: linear issue archive [options] [issueId]

Archive an issue

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### unarchive

> Unarchive an issue

```
Usage: linear issue unarchive [options] [issueId]

Unarchive an issue

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### comment

> Manage issue comments

```
Usage: linear issue comment [options] [command]

Manage issue comments

Options:
  --workspace <slug>            Target workspace (uses credentials)
  -h, --help                    display help for command

Commands:
  add [options] [issueId]       Add a comment to an issue or reply to a comment
  delete [options] <commentId>  Delete a comment
  update [options] <commentId>  Update an existing comment
  list [options] [issueId]      List comments for an issue
```

#### comment subcommands

##### add

```
Usage: linear issue comment add [options] [issueId]

Add a comment to an issue or reply to a comment

Options:
  -b, --body <text>        Comment body text
  --body-file <path>       Read comment body from a file (preferred for markdown
                           content)
  -p, --parent <id>        Parent comment ID for replies
  -a, --attach <filepath>  Attach a file to the comment (can be used multiple
                           times)
  --workspace <slug>       Target workspace (uses credentials)
  -h, --help               display help for command
```

##### delete

```
Usage: linear issue comment delete [options] <commentId>

Delete a comment

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

##### update

```
Usage: linear issue comment update [options] <commentId>

Update an existing comment

Options:
  -b, --body <text>   New comment body text
  --body-file <path>  Read comment body from a file (preferred for markdown
                      content)
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

##### list

```
Usage: linear issue comment list [options] [issueId]

List comments for an issue

Options:
  -j, --json          Output as JSON
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### attach

> Attach a file to an issue

```
Usage: linear issue attach [options] <issueId> <filepath>

Attach a file to an issue

Options:
  -t, --title <title>   Custom title for the attachment
  -c, --comment <body>  Add a comment body linked to the attachment
  --workspace <slug>    Target workspace (uses credentials)
  -h, --help            display help for command
```

### link

> Link a URL to an issue

```
Usage: linear issue link [options] <urlOrIssueId> [url]

Link a URL to an issue

Options:
  -t, --title <title>  Custom title for the link
  --workspace <slug>   Target workspace (uses credentials)
  -h, --help           display help for command

Examples:
  $ linear issue link https://github.com/org/repo/pull/123
  $ linear issue link ENG-123 https://github.com/org/repo/pull/123
  $ linear issue link ENG-123 https://example.com --title "Design doc"
```

### relation

> Manage issue relations (dependencies)

```
Usage: linear issue relation [options] [command]

Manage issue relations (dependencies)

Options:
  --workspace <slug>                                          Target workspace (uses credentials)
  -h, --help                                                  display help for command

Commands:
  add [options] <issueId> <relationType> <relatedIssueId>     Add a relation between two issues
  delete [options] <issueId> <relationType> <relatedIssueId>  Delete a relation between two issues
  list [options] [issueId]                                    List relations for an issue
```

#### relation subcommands

##### add

```
Usage: linear issue relation add [options] <issueId> <relationType> <relatedIssueId>

Add a relation between two issues

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command

Examples:
  $ linear issue relation add ENG-123 blocked-by ENG-100
  $ linear issue relation add ENG-123 blocks ENG-456
  $ linear issue relation add ENG-123 related ENG-456
  $ linear issue relation add ENG-123 duplicate ENG-100
```

##### delete

```
Usage: linear issue relation delete [options] <issueId> <relationType> <relatedIssueId>

Delete a relation between two issues

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

##### list

```
Usage: linear issue relation list [options] [issueId]

List relations for an issue

Options:
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### agent-session

> Manage agent sessions for an issue

```
Usage: linear issue agent-session [options] [command]

Manage agent sessions for an issue

Options:
  --workspace <slug>            Target workspace (uses credentials)
  -h, --help                    display help for command

Commands:
  list [options] [issueId]      List agent sessions for an issue
  view|v [options] <sessionId>  View agent session details
```

#### agent-session subcommands

##### list

```
Usage: linear issue agent-session list [options] [issueId]

List agent sessions for an issue

Options:
  -j, --json          Output as JSON
  --status <status>   Filter by session status (choices: "pending", "active",
                      "complete", "awaitingInput", "error", "stale")
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

##### view

```
Usage: linear issue agent-session view|v [options] <sessionId>

View agent session details

Options:
  -j, --json          Output as JSON
  --no-pager          Disable automatic paging for long output
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
