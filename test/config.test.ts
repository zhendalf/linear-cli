import { expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  DEFAULT_ISSUE_SORT,
  getOption,
  ISSUE_SORT_VALUES,
  init,
  resolveIssueSort,
} from "../src/config.ts"
import { ValidationError } from "../src/utils/errors.ts"

// Note: These tests use the cliValue parameter (highest precedence)
// to avoid interference from config files that may exist in the repo

test("getOption - download_images returns boolean for truthy strings", () => {
  const truthyValues = ["true", "TRUE", "True", "yes", "YES", "y", "Y", "on", "ON", "1", "t", "T"]

  for (const value of truthyValues) {
    const result = getOption("download_images", value)
    expect(result).toBe(true)
  }
})

test("getOption - download_images returns boolean for falsy strings", () => {
  const falsyValues = ["false", "FALSE", "False", "no", "NO", "n", "N", "off", "OFF", "0", "f", "F"]

  for (const value of falsyValues) {
    const result = getOption("download_images", value)
    expect(result).toBe(false)
  }
})

test("getOption - download_images returns undefined for unrecognized strings", () => {
  const result = getOption("download_images", "maybe")
  expect(result).toBeUndefined()
})

test("getOption - environment variables take precedence over config file", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-config-test-"))
  const configValue = "from-config-file"
  const envValue = "from-env-var"
  const originalCwd = process.cwd()
  const origXdg = process.env["XDG_CONFIG_HOME"]
  const origLinearWorkspace = process.env["LINEAR_WORKSPACE"]

  try {
    await writeFile(join(tempDir, ".linear.toml"), `workspace = "${configValue}"\n`)
    process.chdir(tempDir)
    process.env["LINEAR_WORKSPACE"] = envValue
    // Reinit config from the temp dir
    await init()
    const result = getOption("workspace")
    expect(result).toBe(envValue)
  } finally {
    process.chdir(originalCwd)
    if (origLinearWorkspace !== undefined) {
      process.env["LINEAR_WORKSPACE"] = origLinearWorkspace
    } else {
      delete process.env["LINEAR_WORKSPACE"]
    }
    if (origXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = origXdg
    } else {
      delete process.env["XDG_CONFIG_HOME"]
    }
    await init() // re-init with real cwd
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("getOption - config file is used when no env var is set", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "linear-config-test-"))
  const configValue = "from-config-file"
  const originalCwd = process.cwd()
  const origLinearWorkspace = process.env["LINEAR_WORKSPACE"]

  try {
    await writeFile(join(tempDir, ".linear.toml"), `workspace = "${configValue}"\n`)
    process.chdir(tempDir)
    delete process.env["LINEAR_WORKSPACE"]
    await init()
    const result = getOption("workspace")
    expect(result).toBe(configValue)
  } finally {
    process.chdir(originalCwd)
    if (origLinearWorkspace !== undefined) {
      process.env["LINEAR_WORKSPACE"] = origLinearWorkspace
    } else {
      delete process.env["LINEAR_WORKSPACE"]
    }
    await init()
    await rm(tempDir, { recursive: true, force: true })
  }
})

test("getOption - home folder config is used as fallback", async () => {
  const tempHome = await mkdtemp(join(tmpdir(), "linear-config-home-test-"))
  const workDir = await mkdtemp(join(tmpdir(), "linear-config-work-test-"))
  const homeConfigValue = "from-home-config"
  const originalCwd = process.cwd()
  const origXdg = process.env["XDG_CONFIG_HOME"]
  const origHome = process.env["HOME"]
  const origLinearWorkspace = process.env["LINEAR_WORKSPACE"]

  try {
    await mkdir(join(tempHome, ".config", "linear"), { recursive: true })
    await writeFile(
      join(tempHome, ".config", "linear", "linear.toml"),
      `workspace = "${homeConfigValue}"\n`,
    )
    process.chdir(workDir)
    delete process.env["LINEAR_WORKSPACE"]
    delete process.env["XDG_CONFIG_HOME"]
    process.env["HOME"] = tempHome
    await init()
    const result = getOption("workspace")
    expect(result).toBe(homeConfigValue)
  } finally {
    process.chdir(originalCwd)
    if (origLinearWorkspace !== undefined) {
      process.env["LINEAR_WORKSPACE"] = origLinearWorkspace
    } else {
      delete process.env["LINEAR_WORKSPACE"]
    }
    if (origXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = origXdg
    } else {
      delete process.env["XDG_CONFIG_HOME"]
    }
    if (origHome !== undefined) {
      process.env["HOME"] = origHome
    } else {
      delete process.env["HOME"]
    }
    await init()
    await rm(tempHome, { recursive: true, force: true })
    await rm(workDir, { recursive: true, force: true })
  }
})

test("getOption - project config takes precedence over home config", async () => {
  const tempHome = await mkdtemp(join(tmpdir(), "linear-config-home-test-"))
  const projectDir = await mkdtemp(join(tmpdir(), "linear-config-proj-test-"))
  const homeConfigValue = "from-home-config"
  const projectConfigValue = "from-project-config"
  const originalCwd = process.cwd()
  const origXdg = process.env["XDG_CONFIG_HOME"]
  const origHome = process.env["HOME"]
  const origLinearWorkspace = process.env["LINEAR_WORKSPACE"]

  try {
    await mkdir(join(tempHome, ".config", "linear"), { recursive: true })
    await writeFile(
      join(tempHome, ".config", "linear", "linear.toml"),
      `workspace = "${homeConfigValue}"\n`,
    )
    await writeFile(join(projectDir, ".linear.toml"), `workspace = "${projectConfigValue}"\n`)
    process.chdir(projectDir)
    delete process.env["LINEAR_WORKSPACE"]
    delete process.env["XDG_CONFIG_HOME"]
    process.env["HOME"] = tempHome
    await init()
    const result = getOption("workspace")
    expect(result).toBe(projectConfigValue)
  } finally {
    process.chdir(originalCwd)
    if (origLinearWorkspace !== undefined) {
      process.env["LINEAR_WORKSPACE"] = origLinearWorkspace
    } else {
      delete process.env["LINEAR_WORKSPACE"]
    }
    if (origXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = origXdg
    } else {
      delete process.env["XDG_CONFIG_HOME"]
    }
    if (origHome !== undefined) {
      process.env["HOME"] = origHome
    } else {
      delete process.env["HOME"]
    }
    await init()
    await rm(tempHome, { recursive: true, force: true })
    await rm(projectDir, { recursive: true, force: true })
  }
})

test("getOption - XDG_CONFIG_HOME takes precedence over HOME/.config", async () => {
  if (process.platform === "win32") return // XDG is Unix-specific

  const tempHome = await mkdtemp(join(tmpdir(), "linear-config-home-test-"))
  const xdgConfigDir = await mkdtemp(join(tmpdir(), "linear-config-xdg-test-"))
  const workDir = await mkdtemp(join(tmpdir(), "linear-config-work-test-"))
  const homeConfigValue = "from-home-config"
  const xdgConfigValue = "from-xdg-config"
  const originalCwd = process.cwd()
  const origXdg = process.env["XDG_CONFIG_HOME"]
  const origHome = process.env["HOME"]
  const origLinearWorkspace = process.env["LINEAR_WORKSPACE"]

  try {
    await mkdir(join(tempHome, ".config", "linear"), { recursive: true })
    await writeFile(
      join(tempHome, ".config", "linear", "linear.toml"),
      `workspace = "${homeConfigValue}"\n`,
    )
    await mkdir(join(xdgConfigDir, "linear"), { recursive: true })
    await writeFile(
      join(xdgConfigDir, "linear", "linear.toml"),
      `workspace = "${xdgConfigValue}"\n`,
    )
    process.chdir(workDir)
    delete process.env["LINEAR_WORKSPACE"]
    process.env["HOME"] = tempHome
    process.env["XDG_CONFIG_HOME"] = xdgConfigDir
    await init()
    const result = getOption("workspace")
    expect(result).toBe(xdgConfigValue)
  } finally {
    process.chdir(originalCwd)
    if (origLinearWorkspace !== undefined) {
      process.env["LINEAR_WORKSPACE"] = origLinearWorkspace
    } else {
      delete process.env["LINEAR_WORKSPACE"]
    }
    if (origXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = origXdg
    } else {
      delete process.env["XDG_CONFIG_HOME"]
    }
    if (origHome !== undefined) {
      process.env["HOME"] = origHome
    } else {
      delete process.env["HOME"]
    }
    await init()
    await rm(tempHome, { recursive: true, force: true })
    await rm(xdgConfigDir, { recursive: true, force: true })
    await rm(workDir, { recursive: true, force: true })
  }
})

test("getOption - global and project configs are merged", async () => {
  const tempHome = await mkdtemp(join(tmpdir(), "linear-config-home-test-"))
  const projectDir = await mkdtemp(join(tmpdir(), "linear-config-proj-test-"))
  const globalIssueSort = "priority"
  const projectWorkspace = "my-workspace"
  const originalCwd = process.cwd()
  const origXdg = process.env["XDG_CONFIG_HOME"]
  const origHome = process.env["HOME"]
  const origLinearWorkspace = process.env["LINEAR_WORKSPACE"]
  const origLinearIssueSort = process.env["LINEAR_ISSUE_SORT"]

  try {
    await mkdir(join(tempHome, ".config", "linear"), { recursive: true })
    await writeFile(
      join(tempHome, ".config", "linear", "linear.toml"),
      `issue_sort = "${globalIssueSort}"\n`,
    )
    await writeFile(join(projectDir, ".linear.toml"), `workspace = "${projectWorkspace}"\n`)
    process.chdir(projectDir)
    delete process.env["LINEAR_WORKSPACE"]
    delete process.env["LINEAR_ISSUE_SORT"]
    delete process.env["XDG_CONFIG_HOME"]
    process.env["HOME"] = tempHome
    await init()
    expect(getOption("issue_sort")).toBe(globalIssueSort)
    expect(getOption("workspace")).toBe(projectWorkspace)
  } finally {
    process.chdir(originalCwd)
    if (origLinearWorkspace !== undefined) {
      process.env["LINEAR_WORKSPACE"] = origLinearWorkspace
    } else {
      delete process.env["LINEAR_WORKSPACE"]
    }
    if (origLinearIssueSort !== undefined) {
      process.env["LINEAR_ISSUE_SORT"] = origLinearIssueSort
    } else {
      delete process.env["LINEAR_ISSUE_SORT"]
    }
    if (origXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = origXdg
    } else {
      delete process.env["XDG_CONFIG_HOME"]
    }
    if (origHome !== undefined) {
      process.env["HOME"] = origHome
    } else {
      delete process.env["HOME"]
    }
    await init()
    await rm(tempHome, { recursive: true, force: true })
    await rm(projectDir, { recursive: true, force: true })
  }
})

test("getOption - env var takes precedence over home config", async () => {
  const tempHome = await mkdtemp(join(tmpdir(), "linear-config-home-test-"))
  const workDir = await mkdtemp(join(tmpdir(), "linear-config-work-test-"))
  const homeConfigValue = "from-home-config"
  const envValue = "from-env-var"
  const originalCwd = process.cwd()
  const origXdg = process.env["XDG_CONFIG_HOME"]
  const origHome = process.env["HOME"]
  const origLinearWorkspace = process.env["LINEAR_WORKSPACE"]

  try {
    await mkdir(join(tempHome, ".config", "linear"), { recursive: true })
    await writeFile(
      join(tempHome, ".config", "linear", "linear.toml"),
      `workspace = "${homeConfigValue}"\n`,
    )
    process.chdir(workDir)
    delete process.env["XDG_CONFIG_HOME"]
    process.env["HOME"] = tempHome
    process.env["LINEAR_WORKSPACE"] = envValue
    await init()
    const result = getOption("workspace")
    expect(result).toBe(envValue)
  } finally {
    process.chdir(originalCwd)
    if (origLinearWorkspace !== undefined) {
      process.env["LINEAR_WORKSPACE"] = origLinearWorkspace
    } else {
      delete process.env["LINEAR_WORKSPACE"]
    }
    if (origXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = origXdg
    } else {
      delete process.env["XDG_CONFIG_HOME"]
    }
    if (origHome !== undefined) {
      process.env["HOME"] = origHome
    } else {
      delete process.env["HOME"]
    }
    await init()
    await rm(tempHome, { recursive: true, force: true })
    await rm(workDir, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// resolveIssueSort
//
// Precedence: --sort flag > LINEAR_ISSUE_SORT > issue_sort config > priority.
// Note the repo's own .linear.toml sets issue_sort = "priority", so anything
// asserting a *different* resolved value must run from an isolated cwd/HOME —
// that's what withIsolatedConfig does.
// ---------------------------------------------------------------------------

/**
 * Run `fn` with config loaded from a throwaway cwd and HOME, so neither the
 * repo's .linear.toml nor the developer's global config can leak in. `toml`
 * (when given) is written as the project .linear.toml; `env` entries are
 * applied on top (`undefined` unsets). LINEAR_ISSUE_SORT is always cleared
 * first so an env var in the runner's environment can't decide the result.
 */
async function withIsolatedConfig(
  opts: { toml?: string; env?: Record<string, string | undefined> },
  fn: () => void | Promise<void>,
): Promise<void> {
  const tempHome = await mkdtemp(join(tmpdir(), "linear-sort-home-"))
  const workDir = await mkdtemp(join(tmpdir(), "linear-sort-work-"))
  const originalCwd = process.cwd()
  const saved: Record<string, string | undefined> = {}
  const setEnv = (key: string, value: string | undefined) => {
    if (!(key in saved)) saved[key] = process.env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }

  try {
    if (opts.toml != null) {
      await writeFile(join(workDir, ".linear.toml"), opts.toml)
    }
    setEnv("HOME", tempHome)
    setEnv("XDG_CONFIG_HOME", join(tempHome, ".config"))
    setEnv("LINEAR_ISSUE_SORT", undefined)
    for (const [key, value] of Object.entries(opts.env ?? {})) {
      setEnv(key, value)
    }
    process.chdir(workDir)
    await init()
    await fn()
  } finally {
    process.chdir(originalCwd)
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    await init()
    await rm(tempHome, { recursive: true, force: true })
    await rm(workDir, { recursive: true, force: true })
  }
}

test("resolveIssueSort - exposes the valid values and the default", () => {
  expect([...ISSUE_SORT_VALUES]).toEqual(["manual", "priority"])
  expect(DEFAULT_ISSUE_SORT).toBe("priority")
})

test("resolveIssueSort - cli flag wins over env var and config", async () => {
  await withIsolatedConfig(
    { toml: 'issue_sort = "priority"\n', env: { LINEAR_ISSUE_SORT: "priority" } },
    () => {
      expect(resolveIssueSort("manual")).toBe("manual")
    },
  )
})

test("resolveIssueSort - env var wins over config", async () => {
  await withIsolatedConfig(
    { toml: 'issue_sort = "priority"\n', env: { LINEAR_ISSUE_SORT: "manual" } },
    () => {
      expect(resolveIssueSort()).toBe("manual")
    },
  )
})

test("resolveIssueSort - config wins over the default", async () => {
  await withIsolatedConfig({ toml: 'issue_sort = "manual"\n' }, () => {
    expect(resolveIssueSort()).toBe("manual")
  })
})

test("resolveIssueSort - defaults to priority when nothing is configured", async () => {
  await withIsolatedConfig({}, () => {
    expect(resolveIssueSort()).toBe("priority")
  })
})

test("resolveIssueSort - invalid cli value throws instead of defaulting", () => {
  expect(() => resolveIssueSort("banana")).toThrow(ValidationError)
  expect(() => resolveIssueSort("banana")).toThrow('Invalid issue sort: "banana"')
})

test("resolveIssueSort - invalid env value throws instead of defaulting", async () => {
  await withIsolatedConfig({ env: { LINEAR_ISSUE_SORT: "banana" } }, () => {
    expect(() => resolveIssueSort()).toThrow('Invalid issue sort: "banana"')
  })
})

test("resolveIssueSort - empty env value throws instead of defaulting", async () => {
  await withIsolatedConfig({ env: { LINEAR_ISSUE_SORT: "" } }, () => {
    expect(() => resolveIssueSort()).toThrow('Invalid issue sort: ""')
  })
})

// The regression this whole helper exists for: getOption() silently returns
// undefined for an unparseable value, so `issue_sort = "banana"` used to fall
// through to the `|| "priority"` default and sort by priority without a word.
test("resolveIssueSort - invalid configured value throws instead of defaulting", async () => {
  await withIsolatedConfig({ toml: 'issue_sort = "banana"\n' }, () => {
    expect(getOption("issue_sort")).toBeUndefined()
    expect(() => resolveIssueSort()).toThrow('Invalid issue sort: "banana"')
  })
})

test("resolveIssueSort - error names the valid values and every input channel", async () => {
  await withIsolatedConfig({ env: { LINEAR_ISSUE_SORT: "banana" } }, () => {
    let suggestion: string | undefined
    try {
      resolveIssueSort()
    } catch (error) {
      suggestion = (error as ValidationError).suggestion
    }
    expect(suggestion).toContain("manual, priority")
    expect(suggestion).toContain("--sort")
    expect(suggestion).toContain("issue_sort")
    expect(suggestion).toContain("LINEAR_ISSUE_SORT")
  })
})
