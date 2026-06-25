import { Command, Option } from "commander"
import { gql } from "../../__codegen__/gql.ts"
import { CliError, NotFoundError, ValidationError, handleError } from "../../utils/errors.ts"
import { getGraphQLClient } from "../../utils/graphql.ts"
import { shouldShowSpinner } from "../../utils/hyperlink.ts"
import { confirm } from "../../utils/prompt.ts"
import { isStdinTTY } from "../../utils/runtime.ts"
import { createSpinner } from "../../utils/spinner.ts"

const GetInitiativeToProjects = gql(`
  query GetInitiativeToProjects($first: Int) {
    initiativeToProjects(first: $first) {
      nodes {
        id
        initiative {
          id
        }
        project {
          id
        }
      }
    }
  }
`)

const RemoveProjectFromInitiative = gql(`
  mutation RemoveProjectFromInitiative($id: String!) {
    initiativeToProjectDelete(id: $id) {
      success
    }
  }
`)

async function resolveInitiativeId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  idOrSlugOrName: string,
): Promise<{ id: string; name: string } | undefined> {
  // Try as UUID first
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlugOrName)) {
    // Get the name for display
    const nameQuery = gql(`
      query GetInitiativeNameByIdForRemove($id: String!) {
        initiative(id: $id) {
          id
          name
        }
      }
    `)
    try {
      const result = await client.request(nameQuery, { id: idOrSlugOrName })
      if (result.initiative) {
        return { id: result.initiative.id, name: result.initiative.name }
      }
    } catch {
      // Continue
    }
    return { id: idOrSlugOrName, name: idOrSlugOrName }
  }

  // Try as slug
  const slugQuery = gql(`
    query GetInitiativeBySlugForRemoveProject($slugId: String!) {
      initiatives(filter: { slugId: { eq: $slugId } }) {
        nodes {
          id
          slugId
          name
        }
      }
    }
  `)

  try {
    const result = await client.request(slugQuery, { slugId: idOrSlugOrName })
    if (result.initiatives?.nodes?.length > 0) {
      const init = result.initiatives.nodes[0]
      return { id: init.id, name: init.name }
    }
  } catch {
    // Continue to name lookup
  }

  // Try as name
  const nameQuery = gql(`
    query GetInitiativeByNameForRemoveProject($name: String!) {
      initiatives(filter: { name: { eqIgnoreCase: $name } }) {
        nodes {
          id
          name
        }
      }
    }
  `)

  try {
    const result = await client.request(nameQuery, { name: idOrSlugOrName })
    if (result.initiatives?.nodes?.length > 0) {
      const init = result.initiatives.nodes[0]
      return { id: init.id, name: init.name }
    }
  } catch {
    // Not found
  }

  return undefined
}

async function resolveProjectId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  idOrSlugOrName: string,
): Promise<{ id: string; name: string } | undefined> {
  // Try as UUID first
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlugOrName)) {
    // Get the name for display
    const nameQuery = gql(`
      query GetProjectNameByIdForRemove($id: String!) {
        project(id: $id) {
          id
          name
        }
      }
    `)
    try {
      const result = await client.request(nameQuery, { id: idOrSlugOrName })
      if (result.project) {
        return { id: result.project.id, name: result.project.name }
      }
    } catch {
      // Continue
    }
    return { id: idOrSlugOrName, name: idOrSlugOrName }
  }

  // Try as slug
  const slugQuery = gql(`
    query GetProjectBySlugForRemoveProject($slugId: String!) {
      projects(filter: { slugId: { eq: $slugId } }) {
        nodes {
          id
          slugId
          name
        }
      }
    }
  `)

  try {
    const result = await client.request(slugQuery, { slugId: idOrSlugOrName })
    if (result.projects?.nodes?.length > 0) {
      const proj = result.projects.nodes[0]
      return { id: proj.id, name: proj.name }
    }
  } catch {
    // Continue to name lookup
  }

  // Try as name
  const nameQuery = gql(`
    query GetProjectByNameForRemoveProject($name: String!) {
      projects(filter: { name: { eqIgnoreCase: $name } }) {
        nodes {
          id
          name
        }
      }
    }
  `)

  try {
    const result = await client.request(nameQuery, { name: idOrSlugOrName })
    if (result.projects?.nodes?.length > 0) {
      const proj = result.projects.nodes[0]
      return { id: proj.id, name: proj.name }
    }
  } catch {
    // Not found
  }

  return undefined
}

export const removeProjectCommand = new Command("remove-project")
  .description("Unlink a project from an initiative")
  .argument("<initiative>")
  .argument("<project>")
  .option("-y, --yes", "Skip confirmation prompt")
  // Back-compat alias for the old --force flag (hidden).
  .addOption(new Option("--force", "Skip confirmation prompt (alias for --yes)").hideHelp())
  .action(async (initiativeArg: string, projectArg: string, options) => {
    const force = options.yes || options.force
    const client = getGraphQLClient()

    // Resolve initiative
    const initiative = await resolveInitiativeId(client, initiativeArg)
    if (!initiative) {
      throw new NotFoundError("Initiative", initiativeArg)
    }

    // Resolve project
    const project = await resolveProjectId(client, projectArg)
    if (!project) {
      throw new NotFoundError("Project", projectArg)
    }

    // Find the initiative-to-project link
    let linkId: string | undefined

    try {
      const linkResult = await client.request(GetInitiativeToProjects, {
        first: 250,
      })

      // Filter client-side for the matching link
      const link = linkResult.initiativeToProjects?.nodes?.find(
        (node: { initiative?: { id: string }; project?: { id: string }; id: string }) =>
          node.initiative?.id === initiative.id && node.project?.id === project.id,
      )
      if (link) {
        linkId = link.id
      }
    } catch (error) {
      handleError(error, "Failed to find project link")
    }

    if (!linkId) {
      console.log(`Project "${project.name}" is not linked to initiative "${initiative.name}"`)
      return
    }

    // Confirm removal
    if (!force) {
      if (!isStdinTTY()) {
        throw new ValidationError("Interactive confirmation required. Use --yes to skip.")
      }
      const confirmed = await confirm({
        message: `Remove "${project.name}" from initiative "${initiative.name}"?`,
        default: true,
      })

      if (!confirmed) {
        console.log("Removal cancelled.")
        return
      }
    }

    const spinner = createSpinner("", shouldShowSpinner())
    spinner.start()

    try {
      const result = await client.request(RemoveProjectFromInitiative, {
        id: linkId,
      })

      spinner.stop()

      if (!result.initiativeToProjectDelete.success) {
        throw new CliError("Failed to remove project from initiative")
      }

      console.log(`✓ Removed "${project.name}" from initiative "${initiative.name}"`)
    } catch (error) {
      spinner.stop()
      handleError(error, "Failed to remove project from initiative")
    }
  })
