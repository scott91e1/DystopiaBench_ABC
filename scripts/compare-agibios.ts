/**
 * compare-agibios.ts — Compare DCS scores across experimental conditions A/B/C.
 *
 * Usage:
 *   pnpm tsx scripts/compare-agibios.ts --runs=pilot-deepseek-A,pilot-deepseek-B,pilot-deepseek-C
 *   pnpm tsx scripts/compare-agibios.ts --experiment-id=agibios-pilot-deepseek
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import type { RunManifestV2, BenchmarkResultV2 } from "../lib/dystopiabench/schemas"

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((v) => v.startsWith(prefix))
  if (arg) return arg.slice(prefix.length)
  const idx = process.argv.indexOf(flag)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

// ---------------------------------------------------------------------------
// Load manifests
// ---------------------------------------------------------------------------

function loadManifest(runId: string): RunManifestV2 {
  const path = resolve("public/data", `benchmark-${runId}.json`)
  return JSON.parse(readFileSync(path, "utf-8")) as RunManifestV2
}

function findManifestsByExperiment(experimentId: string): RunManifestV2[] {
  const dataDir = resolve("public/data")
  const files = readdirSync(dataDir).filter((f) => f.startsWith("benchmark-") && f.endsWith(".json"))
  const manifests: RunManifestV2[] = []
  for (const file of files) {
    try {
      const manifest = JSON.parse(readFileSync(resolve(dataDir, file), "utf-8")) as RunManifestV2
      if (manifest.metadata.experimentId === experimentId) {
        manifests.push(manifest)
      }
    } catch {
      // skip invalid files
    }
  }
  return manifests
}

// ---------------------------------------------------------------------------
// Analysis types
// ---------------------------------------------------------------------------

interface ConditionSummary {
  condition: string
  totalPrompts: number
  scoredPrompts: number
  averageDcs: number
  drfr: number // Dystopian Refusal/Flag Rate (% refusal + hesitant)
  complianceDistribution: Record<string, number>
  byLevel: Record<number, { avgDcs: number; count: number; drfr: number }>
  byScenario: Record<string, { avgDcs: number; count: number; drfr: number }>
}

interface ComparisonResult {
  experimentId: string
  model: string
  module: string
  conditions: ConditionSummary[]
  pairwiseDeltas: Array<{
    pair: string
    dcsDelta: number
    drfrDelta: number
    interpretation: string
  }>
  levelBreakdown: Array<{
    level: number
    conditionA: number
    conditionB: number
    conditionC: number | null
    deltaAB: number
    deltaAC: number | null
  }>
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function stddev(values: number[]): number {
  if (values.length <= 1) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1))
}

/**
 * Cliff's delta effect size (non-parametric).
 * Range: [-1, 1]. Absolute value thresholds:
 *   |d| < 0.147 = negligible
 *   |d| < 0.33  = small
 *   |d| < 0.474 = medium
 *   |d| >= 0.474 = large
 */
function cliffsDelta(group1: number[], group2: number[]): number {
  if (group1.length === 0 || group2.length === 0) return 0
  let more = 0
  let less = 0
  for (const a of group1) {
    for (const b of group2) {
      if (a > b) more++
      else if (a < b) less++
    }
  }
  return (more - less) / (group1.length * group2.length)
}

function cliffsDeltaLabel(d: number): string {
  const abs = Math.abs(d)
  if (abs < 0.147) return "negligible"
  if (abs < 0.33) return "small"
  if (abs < 0.474) return "medium"
  return "large"
}

// ---------------------------------------------------------------------------
// Build condition summary
// ---------------------------------------------------------------------------

function buildConditionSummary(results: BenchmarkResultV2[], condition: string): ConditionSummary {
  const scored = results.filter((r) => r.score !== null && r.score !== undefined)
  const scores = scored.map((r) => r.score as number)

  const complianceDistribution: Record<string, number> = {
    refusal: 0, hesitant: 0, compliant: 0, proactive: 0,
  }
  for (const r of scored) {
    complianceDistribution[r.compliance] = (complianceDistribution[r.compliance] ?? 0) + 1
  }

  const refusalHesitant = (complianceDistribution.refusal ?? 0) + (complianceDistribution.hesitant ?? 0)
  const drfr = scored.length > 0 ? (refusalHesitant / scored.length) * 100 : 0

  // By level
  const byLevel: Record<number, { avgDcs: number; count: number; drfr: number }> = {}
  for (let level = 1; level <= 5; level++) {
    const levelResults = scored.filter((r) => r.level === level)
    const levelScores = levelResults.map((r) => r.score as number)
    const levelRefHes = levelResults.filter((r) => r.compliance === "refusal" || r.compliance === "hesitant").length
    byLevel[level] = {
      avgDcs: Math.round(mean(levelScores)),
      count: levelResults.length,
      drfr: levelResults.length > 0 ? Math.round((levelRefHes / levelResults.length) * 100) : 0,
    }
  }

  // By scenario
  const byScenario: Record<string, { avgDcs: number; count: number; drfr: number }> = {}
  const scenarioIds = [...new Set(scored.map((r) => r.scenarioId))]
  for (const sid of scenarioIds) {
    const sResults = scored.filter((r) => r.scenarioId === sid)
    const sScores = sResults.map((r) => r.score as number)
    const sRefHes = sResults.filter((r) => r.compliance === "refusal" || r.compliance === "hesitant").length
    byScenario[sid] = {
      avgDcs: Math.round(mean(sScores)),
      count: sResults.length,
      drfr: sResults.length > 0 ? Math.round((sRefHes / sResults.length) * 100) : 0,
    }
  }

  return {
    condition,
    totalPrompts: results.length,
    scoredPrompts: scored.length,
    averageDcs: Math.round(mean(scores)),
    drfr: Math.round(drfr),
    complianceDistribution,
    byLevel,
    byScenario,
  }
}

// ---------------------------------------------------------------------------
// Main comparison
// ---------------------------------------------------------------------------

function compareConditions(manifests: RunManifestV2[]): ComparisonResult {
  const conditionMap = new Map<string, RunManifestV2>()
  for (const m of manifests) {
    const cond = (m.metadata as Record<string, unknown>).condition as string ?? "A"
    conditionMap.set(cond, m)
  }

  const conditions = ["A", "B", "C"].filter((c) => conditionMap.has(c))
  const summaries: ConditionSummary[] = conditions.map((c) => {
    const manifest = conditionMap.get(c)!
    return buildConditionSummary(manifest.results, c)
  })

  // Pairwise deltas
  const pairwiseDeltas: ComparisonResult["pairwiseDeltas"] = []
  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const a = summaries[i]
      const b = summaries[j]
      const dcsDelta = b.averageDcs - a.averageDcs
      const drfrDelta = b.drfr - a.drfr

      const scoresA = conditionMap.get(conditions[i])!.results
        .filter((r) => r.score !== null)
        .map((r) => r.score as number)
      const scoresB = conditionMap.get(conditions[j])!.results
        .filter((r) => r.score !== null)
        .map((r) => r.score as number)
      const delta = cliffsDelta(scoresA, scoresB)

      let interpretation = ""
      if (dcsDelta < -10) {
        interpretation = `${conditions[j]} significantly reduces compliance (${cliffsDeltaLabel(delta)} effect)`
      } else if (dcsDelta > 10) {
        interpretation = `${conditions[j]} increases compliance (${cliffsDeltaLabel(delta)} effect)`
      } else {
        interpretation = `No meaningful difference (${cliffsDeltaLabel(delta)} effect)`
      }

      pairwiseDeltas.push({
        pair: `${conditions[i]} vs ${conditions[j]}`,
        dcsDelta,
        drfrDelta,
        interpretation,
      })
    }
  }

  // Level breakdown
  const levelBreakdown: ComparisonResult["levelBreakdown"] = []
  for (let level = 1; level <= 5; level++) {
    const aLevel = summaries.find((s) => s.condition === "A")?.byLevel[level]
    const bLevel = summaries.find((s) => s.condition === "B")?.byLevel[level]
    const cLevel = summaries.find((s) => s.condition === "C")?.byLevel[level]

    levelBreakdown.push({
      level,
      conditionA: aLevel?.avgDcs ?? -1,
      conditionB: bLevel?.avgDcs ?? -1,
      conditionC: cLevel?.avgDcs ?? null,
      deltaAB: (bLevel?.avgDcs ?? 0) - (aLevel?.avgDcs ?? 0),
      deltaAC: cLevel ? (cLevel.avgDcs ?? 0) - (aLevel?.avgDcs ?? 0) : null,
    })
  }

  const firstManifest = manifests[0]
  return {
    experimentId: (firstManifest.metadata as Record<string, unknown>).experimentId as string ?? "unknown",
    model: firstManifest.metadata.models[0] ?? "unknown",
    module: firstManifest.metadata.module as string,
    conditions: summaries,
    pairwiseDeltas,
    levelBreakdown,
  }
}

// ---------------------------------------------------------------------------
// Print report
// ---------------------------------------------------------------------------

function printReport(result: ComparisonResult): void {
  console.log("\n" + "=".repeat(80))
  console.log("AGIBIOS GUARDRAIL COMPARISON REPORT")
  console.log("=".repeat(80))
  console.log(`Experiment: ${result.experimentId}`)
  console.log(`Model: ${result.model}`)
  console.log(`Module: ${result.module}`)
  console.log()

  // Overview table
  console.log("CONDITION OVERVIEW:")
  console.log("-".repeat(60))
  console.log("Condition  | Avg DCS | DRFR  | Refusal | Hesitant | Compliant | Proactive")
  console.log("-".repeat(60))
  for (const s of result.conditions) {
    const d = s.complianceDistribution
    console.log(
      `${s.condition.padEnd(10)} | ${String(s.averageDcs).padStart(7)} | ${String(s.drfr + "%").padStart(5)} | ${String(d.refusal ?? 0).padStart(7)} | ${String(d.hesitant ?? 0).padStart(8)} | ${String(d.compliant ?? 0).padStart(9)} | ${String(d.proactive ?? 0).padStart(9)}`
    )
  }
  console.log()

  // Level breakdown
  console.log("LEVEL BREAKDOWN (Avg DCS):")
  console.log("-".repeat(60))
  console.log("Level | Cond A | Cond B | Cond C | Delta A-B | Delta A-C")
  console.log("-".repeat(60))
  for (const row of result.levelBreakdown) {
    const cC = row.conditionC !== null ? String(row.conditionC).padStart(6) : "   N/A"
    const dAC = row.deltaAC !== null ? String(row.deltaAC).padStart(9) : "      N/A"
    console.log(
      `  L${row.level}  | ${String(row.conditionA).padStart(6)} | ${String(row.conditionB).padStart(6)} | ${cC} | ${String(row.deltaAB).padStart(9)} | ${dAC}`
    )
  }
  console.log()

  // Pairwise comparisons
  console.log("PAIRWISE COMPARISONS:")
  console.log("-".repeat(60))
  for (const p of result.pairwiseDeltas) {
    console.log(`  ${p.pair}: DCS delta = ${p.dcsDelta}, DRFR delta = ${p.drfrDelta}%`)
    console.log(`    → ${p.interpretation}`)
  }
  console.log()
  console.log("=".repeat(80))
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const runsArg = parseArg("--runs")
  const experimentArg = parseArg("--experiment-id")
  const outputArg = parseArg("--output")

  let manifests: RunManifestV2[]

  if (runsArg) {
    const runIds = runsArg.split(",").map((s) => s.trim())
    manifests = runIds.map(loadManifest)
  } else if (experimentArg) {
    manifests = findManifestsByExperiment(experimentArg)
    if (manifests.length === 0) {
      console.error(`No runs found for experiment: ${experimentArg}`)
      process.exitCode = 1
      return
    }
  } else {
    console.error("Usage: --runs=id1,id2,id3 or --experiment-id=name")
    process.exitCode = 1
    return
  }

  console.log(`Loaded ${manifests.length} run manifest(s)`)

  const result = compareConditions(manifests)
  printReport(result)

  // Save JSON report
  if (outputArg) {
    writeFileSync(outputArg, JSON.stringify(result, null, 2))
    console.log(`JSON report saved to: ${outputArg}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
