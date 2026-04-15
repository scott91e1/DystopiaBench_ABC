/**
 * batch-benchmark.ts — Orchestration script with cache detection.
 *
 * Reads configs/models-to-test.json and runs benchmarks only for
 * model x condition pairs that don't already have cached results
 * in public/data/.
 *
 * Usage:
 *   pnpm tsx scripts/batch-benchmark.ts
 *   pnpm tsx scripts/batch-benchmark.ts --dry-run
 *   pnpm tsx scripts/batch-benchmark.ts --models=deepseek,grok
 *   pnpm tsx scripts/batch-benchmark.ts --overwrite-existing
 *   pnpm tsx scripts/batch-benchmark.ts --overwrite-existing --models=kimi
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelEntry {
  id: string
  modelId: string
  modelString: string
  label: string
  status: "complete" | "pending" | "skipped"
}

interface ModelsConfig {
  models: ModelEntry[]
  conditions: string[]
  module: string
}

// ---------------------------------------------------------------------------
// CLI argument parsing (matches existing project conventions)
// ---------------------------------------------------------------------------

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((v) => v.startsWith(prefix))
  if (arg) return arg.slice(prefix.length)
  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function getProjectRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  return resolve(scriptDir, "..")
}

function getDataDir(): string {
  return join(getProjectRoot(), "public", "data")
}

function getConfigPath(): string {
  return join(getProjectRoot(), "configs", "models-to-test.json")
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadModelsConfig(): ModelsConfig {
  const configPath = getConfigPath()
  if (!existsSync(configPath)) {
    throw new Error(`Models config not found: ${configPath}`)
  }
  const raw = readFileSync(configPath, "utf-8")
  const parsed = JSON.parse(raw) as ModelsConfig

  if (!Array.isArray(parsed.models) || parsed.models.length === 0) {
    throw new Error("models-to-test.json must contain a non-empty 'models' array")
  }
  if (!Array.isArray(parsed.conditions) || parsed.conditions.length === 0) {
    throw new Error("models-to-test.json must contain a non-empty 'conditions' array")
  }
  if (!parsed.module) {
    throw new Error("models-to-test.json must contain a 'module' field")
  }

  return parsed
}

// ---------------------------------------------------------------------------
// Cache detection
// ---------------------------------------------------------------------------

function getBenchmarkFilename(pilotId: string, condition: string): string {
  return `benchmark-pilot-${pilotId}-${condition}.json`
}

function isCached(pilotId: string, condition: string): boolean {
  const dataDir = getDataDir()
  const filename = getBenchmarkFilename(pilotId, condition)
  return existsSync(join(dataDir, filename))
}

function getComparisonFilename(pilotId: string): string {
  return `pilot-${pilotId}-comparison.json`
}

function isComparisonCached(pilotId: string): boolean {
  // Comparisons can be in public/data or artifacts/private
  const publicPath = join(getDataDir(), getComparisonFilename(pilotId))
  const privatePath = join(getProjectRoot(), "artifacts", "private", getComparisonFilename(pilotId))
  return existsSync(publicPath) || existsSync(privatePath)
}

// ---------------------------------------------------------------------------
// Benchmark execution
// ---------------------------------------------------------------------------

interface BenchmarkTask {
  model: ModelEntry
  condition: string
  cached: boolean
  runId: string
}

function matchesFilter(model: ModelEntry, filterIds: string[]): boolean {
  return filterIds.some((f) =>
    f === model.id || f === model.modelId || f === model.label.toLowerCase()
  )
}

function buildTaskList(
  config: ModelsConfig,
  filterModelIds: string[] | null,
  overwrite: boolean,
): BenchmarkTask[] {
  const tasks: BenchmarkTask[] = []

  for (const model of config.models) {
    // Filter by --models flag if provided (accepts id, modelId, or label)
    if (filterModelIds && !matchesFilter(model, filterModelIds)) {
      continue
    }

    for (const condition of config.conditions) {
      const runId = `pilot-${model.id}-${condition}`
      const cached = !overwrite && isCached(model.id, condition)
      tasks.push({ model, condition, cached, runId })
    }
  }

  return tasks
}

function runSingleBenchmark(task: BenchmarkTask, config: ModelsConfig): void {
  const { model, condition, runId } = task
  const projectRoot = getProjectRoot()

  console.log(`\n  Running: ${model.label} | Condition ${condition} | Run ID: ${runId}`)

  const cmd = [
    "pnpm tsx scripts/run-benchmark.ts",
    `--module=${config.module}`,
    `--models=${model.modelId}`,
    `--condition=${condition}`,
    `--run-id=${runId}`,
    `--experiment-id=agibios-pilot-${model.id}`,
  ].join(" ")

  try {
    execSync(cmd, {
      cwd: projectRoot,
      stdio: "inherit",
      timeout: 3_600_000, // 60 minute timeout per run
    })
    console.log(`  Completed: ${model.label} | Condition ${condition}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`  FAILED: ${model.label} | Condition ${condition} — ${message}`)
  }
}

function runComparison(model: ModelEntry, conditions: string[]): void {
  const projectRoot = getProjectRoot()
  const runIds = conditions.map((c) => `pilot-${model.id}-${c}`).join(",")
  const outputDir = join(projectRoot, "artifacts", "private")
  mkdirSync(outputDir, { recursive: true })

  console.log(`\n  Generating comparison for: ${model.label}`)

  const cmd = [
    "pnpm tsx scripts/compare-agibios.ts",
    `--runs=${runIds}`,
    `--output=artifacts/private/pilot-${model.id}-comparison.json`,
  ].join(" ")

  try {
    execSync(cmd, {
      cwd: projectRoot,
      stdio: "inherit",
      timeout: 120_000,
    })
    console.log(`  Comparison saved: pilot-${model.id}-comparison.json`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`  FAILED comparison for ${model.label}: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const overwrite = hasFlag("--overwrite-existing")
  const dryRun = hasFlag("--dry-run")
  const modelsArg = parseArg("--models")
  const filterModelIds = modelsArg
    ? modelsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : null

  const config = loadModelsConfig()
  const tasks = buildTaskList(config, filterModelIds, overwrite)

  const cached = tasks.filter((t) => t.cached)
  const pending = tasks.filter((t) => !t.cached)

  console.log("=".repeat(70))
  console.log("DYSTOPIABENCH BATCH BENCHMARK ORCHESTRATOR")
  console.log("=".repeat(70))
  console.log(`Module: ${config.module}`)
  console.log(`Models: ${config.models.length} configured, ${filterModelIds ? filterModelIds.length + " selected" : "all"}`)
  console.log(`Conditions: ${config.conditions.join(", ")}`)
  console.log(`Total tasks: ${tasks.length}`)
  console.log(`Cached (skip): ${cached.length}`)
  console.log(`Pending (run): ${pending.length}`)
  if (overwrite) console.log("Overwrite mode: ON (re-running all)")
  if (dryRun) console.log("Dry-run mode: ON (no execution)")
  console.log()

  // Log cached items
  if (cached.length > 0) {
    console.log("CACHED (will skip):")
    for (const task of cached) {
      console.log(`  Skipping ${task.model.label} condition ${task.condition} — already cached`)
    }
    console.log()
  }

  // Log pending items
  if (pending.length > 0) {
    console.log("PENDING (will run):")
    for (const task of pending) {
      console.log(`  Will run ${task.model.label} condition ${task.condition} → ${task.runId}`)
    }
    console.log()
  }

  if (dryRun) {
    console.log("Dry-run complete. No benchmarks were executed.")
    return
  }

  if (pending.length === 0) {
    console.log("All benchmarks are cached. Nothing to run.")
  } else {
    console.log(`Running ${pending.length} benchmark(s)...`)
    console.log("-".repeat(70))

    for (const task of pending) {
      runSingleBenchmark(task, config)
    }
  }

  // Regenerate comparisons for models that have all conditions complete
  console.log()
  console.log("-".repeat(70))
  console.log("COMPARISON GENERATION:")

  const modelsToCompare: ModelEntry[] = []
  for (const model of config.models) {
    if (filterModelIds && !matchesFilter(model, filterModelIds)) continue

    const allConditionsCached = config.conditions.every((c) => isCached(model.id, c))
    if (!allConditionsCached) {
      console.log(`  Skipping comparison for ${model.label} — not all conditions complete`)
      continue
    }

    // Only regenerate if we ran something new for this model, or overwrite is on
    const ranSomething = pending.some((t) => t.model.id === model.id)
    if (!ranSomething && !overwrite && isComparisonCached(model.id)) {
      console.log(`  Skipping comparison for ${model.label} — already cached`)
      continue
    }

    modelsToCompare.push(model)
  }

  if (modelsToCompare.length > 0) {
    for (const model of modelsToCompare) {
      runComparison(model, config.conditions)
    }
  } else {
    console.log("  No new comparisons needed.")
  }

  console.log()
  console.log("=".repeat(70))
  console.log("Batch benchmark complete.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
