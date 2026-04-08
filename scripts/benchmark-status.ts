/**
 * benchmark-status.ts — Print a status dashboard showing which
 * model x condition benchmark results are cached in public/data/.
 *
 * Usage:
 *   pnpm tsx scripts/benchmark-status.ts
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

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
  return JSON.parse(readFileSync(configPath, "utf-8")) as ModelsConfig
}

// ---------------------------------------------------------------------------
// Cache detection
// ---------------------------------------------------------------------------

function isCached(pilotId: string, condition: string): boolean {
  const dataDir = getDataDir()
  return existsSync(join(dataDir, `benchmark-pilot-${pilotId}-${condition}.json`))
}

function isComparisonCached(pilotId: string): boolean {
  const publicPath = join(getDataDir(), `pilot-${pilotId}-comparison.json`)
  const privatePath = join(getProjectRoot(), "artifacts", "private", `pilot-${pilotId}-comparison.json`)
  return existsSync(publicPath) || existsSync(privatePath)
}

// ---------------------------------------------------------------------------
// Summary stats from cached files
// ---------------------------------------------------------------------------

interface CachedRunSummary {
  avgDcs: number
  drfr: number
}

function readCachedSummary(pilotId: string, condition: string): CachedRunSummary | null {
  const dataDir = getDataDir()
  const filePath = join(dataDir, `benchmark-pilot-${pilotId}-${condition}.json`)
  if (!existsSync(filePath)) return null

  try {
    const manifest = JSON.parse(readFileSync(filePath, "utf-8"))
    return {
      avgDcs: manifest.summary?.averageDcs ?? -1,
      drfr: manifest.summary?.drfr ?? -1,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function padCenter(text: string, width: number): string {
  const padding = Math.max(0, width - text.length)
  const left = Math.floor(padding / 2)
  const right = padding - left
  return " ".repeat(left) + text + " ".repeat(right)
}

function printStatusTable(config: ModelsConfig): void {
  const CHECK = "\u2713"
  const CROSS = "\u2717"

  // Column widths
  const labelWidth = Math.max(16, ...config.models.map((m) => m.label.length + 2))
  const condWidth = 8
  const compWidth = 12
  const statusWidth = 9

  // Header
  const condHeaders = config.conditions.map((c) => padCenter(`Cond ${c}`, condWidth)).join(" | ")
  const header = `${"Model".padEnd(labelWidth)} | ${condHeaders} | ${padCenter("Comparison", compWidth)} | ${padCenter("Status", statusWidth)}`
  const separator = "-".repeat(header.length)

  console.log()
  console.log("=".repeat(header.length))
  console.log("DYSTOPIABENCH — BENCHMARK STATUS DASHBOARD")
  console.log("=".repeat(header.length))
  console.log(`Module: ${config.module}`)
  console.log()
  console.log(header)
  console.log(separator)

  let totalCached = 0
  let totalPending = 0
  let totalComparisons = 0

  for (const model of config.models) {
    const condCells: string[] = []
    let allCondsCached = true

    for (const condition of config.conditions) {
      const cached = isCached(model.id, condition)
      if (cached) {
        totalCached++
        condCells.push(padCenter(CHECK, condWidth))
      } else {
        totalPending++
        allCondsCached = false
        condCells.push(padCenter(CROSS, condWidth))
      }
    }

    const comparison = allCondsCached && isComparisonCached(model.id)
    if (comparison) totalComparisons++
    const compCell = padCenter(comparison ? CHECK : CROSS, compWidth)

    const statusLabel = model.status === "complete"
      ? "done"
      : model.status === "skipped"
        ? "skip"
        : "pending"
    const statusCell = padCenter(statusLabel, statusWidth)

    console.log(`${model.label.padEnd(labelWidth)} | ${condCells.join(" | ")} | ${compCell} | ${statusCell}`)
  }

  console.log(separator)
  console.log()

  // Summary
  const totalTasks = config.models.length * config.conditions.length
  const completeModels = config.models.filter((m) =>
    config.conditions.every((c) => isCached(m.id, c))
  ).length

  console.log("SUMMARY:")
  console.log(`  Benchmark runs:  ${totalCached}/${totalTasks} cached`)
  console.log(`  Pending runs:    ${totalPending}`)
  console.log(`  Complete models: ${completeModels}/${config.models.length}`)
  console.log(`  Comparisons:     ${totalComparisons}/${config.models.length}`)

  // Show DCS overview for completed models
  const completedModels = config.models.filter((m) =>
    config.conditions.every((c) => isCached(m.id, c))
  )

  if (completedModels.length > 0) {
    console.log()
    console.log("DCS OVERVIEW (Avg DCS per condition):")
    const dcsHeader = `${"Model".padEnd(labelWidth)} | ${config.conditions.map((c) => padCenter(`Cond ${c}`, condWidth)).join(" | ")}`
    console.log(dcsHeader)
    console.log("-".repeat(dcsHeader.length))

    for (const model of completedModels) {
      const cells = config.conditions.map((c) => {
        const summary = readCachedSummary(model.id, c)
        return padCenter(summary ? String(summary.avgDcs) : "?", condWidth)
      })
      console.log(`${model.label.padEnd(labelWidth)} | ${cells.join(" | ")}`)
    }
  }

  console.log()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const config = loadModelsConfig()
  printStatusTable(config)
}

main()
