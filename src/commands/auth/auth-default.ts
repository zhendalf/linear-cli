import { Command } from "commander"
import {
  getDefaultWorkspace,
  getWorkspaces,
  hasWorkspace,
  setDefaultWorkspace,
} from "../../credentials.ts"
import { AuthError, NotFoundError, handleError } from "../../utils/errors.ts"
import { select } from "../../utils/prompt.ts"

export const defaultCommand = new Command("default")
  .description("Set the default workspace")
  .argument("[workspace]", "Workspace slug to set as default")
  .action(async (workspace: string | undefined) => {
    try {
      const workspaces = getWorkspaces()

      if (workspaces.length === 0) {
        throw new AuthError("No workspaces configured", {
          suggestion: "Run `linear auth login` to add a workspace",
        })
      }

      if (workspaces.length === 1) {
        console.log(`Only one workspace configured: ${workspaces[0]}`)
        return
      }

      const currentDefault = getDefaultWorkspace()

      // If no workspace specified, prompt to select one
      if (!workspace) {
        workspace = await select({
          message: "Select default workspace",
          choices: workspaces.map((ws) => ({
            name: ws === currentDefault ? `${ws} (current)` : ws,
            value: ws,
          })),
        })
      }

      if (!hasWorkspace(workspace)) {
        throw new NotFoundError("Workspace", workspace, {
          suggestion: `Available workspaces: ${workspaces.join(", ")}`,
        })
      }

      if (workspace === currentDefault) {
        console.log(`"${workspace}" is already the default workspace`)
        return
      }

      await setDefaultWorkspace(workspace)
      console.log(`Default workspace set to: ${workspace}`)
    } catch (error) {
      handleError(error, "Failed to set default workspace")
    }
  })
