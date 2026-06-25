import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCommand } from "./runtime.ts"

export async function getEditor(): Promise<string | null> {
  // Try git config first
  try {
    const { success, stdout } = await runCommand("git", ["config", "--global", "core.editor"])
    if (success) {
      const editor = stdout.trim()
      if (editor) return editor
    }
  } catch {
    // Fall through to next option
  }

  // Try EDITOR environment variable
  const editor = process.env["EDITOR"]
  if (editor) return editor

  return null
}

export async function openEditor(): Promise<string | undefined> {
  const editor = await getEditor()
  if (!editor) {
    console.error(
      "No editor found. Please set EDITOR environment variable or configure git editor with: git config --global core.editor <editor>",
    )
    return undefined
  }

  // Create a temporary file (mkdtemp + join to get a .md file)
  const dir = await mkdtemp(join(tmpdir(), "linear-cli-"))
  const tempFile = join(dir, "edit.md")

  // Write empty file so the editor has something to open
  const { writeFile } = await import("node:fs/promises")
  await writeFile(tempFile, "")

  try {
    // Open the editor with inherited stdio so the user can interact
    // runCommand uses execFile which does NOT inherit stdio, so we use
    // spawn directly here.
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(editor, [tempFile], {
        stdio: "inherit",
        shell: false,
      })
      child.on("error", reject)
      child.on("close", (code) => resolve(code ?? 1))
    })

    if (exitCode !== 0) {
      console.error("Editor exited with an error")
      return undefined
    }

    // Read the content back
    const content = await readFile(tempFile, "utf8")
    const cleaned = content.trim()

    return cleaned.length > 0 ? cleaned : undefined
  } catch (error) {
    console.error("Failed to open editor:", error instanceof Error ? error.message : String(error))
    return undefined
  } finally {
    // Clean up the temporary file
    try {
      await rm(tempFile, { force: true })
      await rm(dir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}
