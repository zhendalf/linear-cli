# document

> Manage Linear documents

## Usage

```
Usage: linear document|docs [options] [command]

Manage Linear documents

Options:
  --workspace <slug>               Target workspace (uses credentials)
  -h, --help                       display help for command

Commands:
  list|l [options]                 List documents
  view|v [options] <id>            View a document's content
  create|c [options]               Create a new document
  update|u [options] <documentId>  Update an existing document
  delete|d [options] [documentId]  Delete a document (moves to trash)
```

## Subcommands

### list

> List documents

```
Usage: linear document list|l [options]

List documents

Options:
  --project <project>  Filter by project (slug or name)
  --issue <issue>      Filter by issue (identifier like TC-123)
  --json               Output as JSON
  --limit <limit>      Limit results (default: 50)
  --workspace <slug>   Target workspace (uses credentials)
  -h, --help           display help for command
```

### view

> View a document's content

```
Usage: linear document view|v [options] <id>

View a document's content

Arguments:
  id                  Document ID or slug

Options:
  --raw               Output raw markdown without rendering
  -w, --web           Open document in browser
  --json              Output full document as JSON
  --no-download       Keep remote URLs instead of downloading files
  --no-pager          Disable automatic paging for long output
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```

### create

> Create a new document

```
Usage: linear document create|c [options]

Create a new document

Options:
  -t, --title <title>        Document title (required)
  -c, --content <content>    Markdown content (inline)
  -f, --content-file <path>  Read content from file
  --project <project>        Attach to project (slug or ID)
  --issue <issue>            Attach to issue (identifier like TC-123)
  --icon <icon>              Document icon (emoji)
  -i, --interactive          Interactive mode with prompts
  --workspace <slug>         Target workspace (uses credentials)
  -h, --help                 display help for command
```

### update

> Update an existing document

```
Usage: linear document update|u [options] <documentId>

Update an existing document

Arguments:
  documentId                 Document ID or slug

Options:
  -t, --title <title>        New title for the document
  -c, --content <content>    New markdown content (inline)
  -f, --content-file <path>  Read new content from file
  --icon <icon>              New icon (emoji)
  --project <project>        Attach to project (UUID, slug ID, or name)
  -e, --edit                 Open current content in $EDITOR for editing
  --force                    Update content even when document comments may lose
                             inline anchors
  --workspace <slug>         Target workspace (uses credentials)
  -h, --help                 display help for command
```

### delete

> Delete a document (moves to trash)

```
Usage: linear document delete|d [options] [documentId]

Delete a document (moves to trash)

Arguments:
  documentId          Document ID or slug

Options:
  -y, --yes           Skip confirmation prompt
  --bulk <ids...>     Delete multiple documents by slug or ID
  --bulk-file <file>  Read document slugs/IDs from a file (one per line)
  --bulk-stdin        Read document slugs/IDs from stdin
  --workspace <slug>  Target workspace (uses credentials)
  -h, --help          display help for command
```
