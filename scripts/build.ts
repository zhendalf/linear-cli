/**
 * Bundle the CLI with Bun into a single runnable dist/main.js.
 * Target `node` so the published bin runs on Node and Bun alike.
 */
import { chmod, rm } from "node:fs/promises"

const outdir = "dist"

await rm(outdir, { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ["src/main.ts"],
  outdir,
  target: "node",
  format: "esm",
  sourcemap: "linked",
  banner: "#!/usr/bin/env node",
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

// Make the bin executable for local/global use.
await chmod(`${outdir}/main.js`, 0o755)

console.log(`Built ${outdir}/main.js`)
