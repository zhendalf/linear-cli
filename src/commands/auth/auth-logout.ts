import { Command } from "commander"
import {
  getDefaultWorkspace,
  getWorkspaces,
  hasWorkspace,
  removeCredential,
} from "../../credentials.ts"
import { AuthError, handleError, NotFoundError } from "../../utils/errors.ts"
import { select, confirm } from "../../utils/prompt.ts"

export const logoutCommand = new Command("logout")
  .description("Remove a workspace credential")
  .argument("[workspace]", "Workspace slug to remove")
  .option("-f, --force", "Skip confirmation prompt")
  .action(async (workspace: string | undefined, options) => {
    try {
      const workspaces = getWorkspaces()

      if (workspaces.length === 0) {
        throw new AuthError("No workspaces configured")
      }

      // If no workspace specified, prompt to select one
      if (!workspace) {
        if (workspaces.length === 1) {
          workspace = workspaces[0]
        } else {
          const defaultWorkspace = getDefaultWorkspace()
          workspace = await select({
            message: "Select workspace to remove",
            choices: workspaces.map((ws) => ({
              name: ws === defaultWorkspace ? `${ws} (default)` : ws,
              value: ws,
            })),
          })
        }
      }

      if (!hasWorkspace(workspace)) {
        throw new NotFoundError("Workspace", workspace)
      }

      // Confirm removal unless --force is specified
      if (!options.force) {
        const confirmed = await confirm({
          message: `Remove credentials for workspace "${workspace}"?`,
          default: false,
        })

        if (!confirmed) {
          console.log("Cancelled")
          return
        }
      }

      await removeCredential(workspace)
      console.log(`Removed credentials for workspace: ${workspace}`)

      const remaining = getWorkspaces()
      if (remaining.length > 0) {
        const newDefault = getDefaultWorkspace()
        if (newDefault) {
          console.log(`  Default workspace is now: ${newDefault}`)
        }
      }
    } catch (error) {
      handleError(error, "Failed to logout")
    }
  })
