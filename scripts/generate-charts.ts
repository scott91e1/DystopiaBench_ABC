/**
 * generate-charts.ts — Generate 5 PNG charts from benchmark comparison data.
 *
 * Charts (per Appendix A):
 *   1. Mean DCS by Model × Condition (grouped bar)
 *   2. DCS by Escalation Level × Condition (line chart)
 *   3. Compliance Distribution by Model (stacked bar)
 *   4. AGIBIOS Effect Size by Model (Cliff's delta bar)
 *   5. Model Ranking by DRFR (horizontal bar)
 *
 * Usage:
 *   pnpm tsx scripts/generate-charts.ts
 *   pnpm tsx scripts/generate-charts.ts --output-dir=artifacts/charts
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve, basename } from "node:path"
import { ChartJSNodeCanvas } from "chartjs-node-canvas"
import type { ChartConfiguration } from "chart.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConditionSummary {
  condition: string
  totalPrompts: number
  scoredPrompts: number
  averageDcs: number
  drfr: number
  complianceDistribution: Record<string, number>
  byLevel: Record<string, { avgDcs: number; count: number; drfr: number }>
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
// Config
// ---------------------------------------------------------------------------

const WIDTH = 1200
const HEIGHT = 700
const COLORS = {
  A: "rgba(59, 130, 246, 0.8)",   // blue — Vanilla
  B: "rgba(239, 68, 68, 0.8)",    // red — Guardrail
  C: "rgba(34, 197, 94, 0.8)",    // green — Hybrid
  ABorder: "rgb(59, 130, 246)",
  BBorder: "rgb(239, 68, 68)",
  CBorder: "rgb(34, 197, 94)",
}

const COMPLIANCE_COLORS = {
  refusal: "rgba(34, 197, 94, 0.8)",    // green — good
  hesitant: "rgba(250, 204, 21, 0.8)",  // yellow
  compliant: "rgba(249, 115, 22, 0.8)", // orange
  proactive: "rgba(239, 68, 68, 0.8)",  // red — bad
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArg(flag: string): string | undefined {
  const prefix = `${flag}=`
  const arg = process.argv.find((v) => v.startsWith(prefix))
  if (arg) return arg.slice(prefix.length)
  return undefined
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------

function loadComparisons(dataDir: string): ComparisonResult[] {
  const files = readdirSync(dataDir).filter(
    (f) => f.startsWith("pilot-") && f.endsWith("-comparison.json"),
  )
  return files.map((f) => {
    const raw = readFileSync(resolve(dataDir, f), "utf-8")
    return JSON.parse(raw) as ComparisonResult
  })
}

// ---------------------------------------------------------------------------
// Cliff's delta (recompute from raw manifests for effect size chart)
// ---------------------------------------------------------------------------

function cliffsDelta(group1: number[], group2: number[]): number {
  if (group1.length === 0 || group2.length === 0) return 0
  let more = 0, less = 0
  for (const a of group1) {
    for (const b of group2) {
      if (a > b) more++
      else if (a < b) less++
    }
  }
  return (more - less) / (group1.length * group2.length)
}

function loadRawScores(model: string): { A: number[]; B: number[]; C: number[] } {
  const dataDir = resolve("public/data")
  const result: { A: number[]; B: number[]; C: number[] } = { A: [], B: [], C: [] }
  for (const cond of ["A", "B", "C"] as const) {
    const modelId = model.toLowerCase().replace(/[\s.]+/g, "-")
    // Try multiple filename patterns
    const patterns = [
      `benchmark-pilot-${modelId}-${cond}.json`,
      `benchmark-pilot-${model}-${cond}.json`,
    ]
    for (const pattern of patterns) {
      try {
        const manifest = JSON.parse(readFileSync(resolve(dataDir, pattern), "utf-8"))
        result[cond] = manifest.results
          .filter((r: { score: number | null }) => r.score !== null)
          .map((r: { score: number }) => r.score)
        break
      } catch { /* try next pattern */ }
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Chart 1: Mean DCS by Model × Condition
// ---------------------------------------------------------------------------

async function chart1MeanDCS(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const models = comparisons.map((c) => c.model)
  const condA = comparisons.map((c) => c.conditions.find((s) => s.condition === "A")?.averageDcs ?? 0)
  const condB = comparisons.map((c) => c.conditions.find((s) => s.condition === "B")?.averageDcs ?? 0)
  const condC = comparisons.map((c) => c.conditions.find((s) => s.condition === "C")?.averageDcs ?? 0)

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: models,
      datasets: [
        { label: "A — Vanilla", data: condA, backgroundColor: COLORS.A, borderColor: COLORS.ABorder, borderWidth: 1 },
        { label: "B — Guardrail", data: condB, backgroundColor: COLORS.B, borderColor: COLORS.BBorder, borderWidth: 1 },
        { label: "C — Hybrid", data: condC, backgroundColor: COLORS.C, borderColor: COLORS.CBorder, borderWidth: 1 },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: "Chart 1: Mean DCS by Model and Condition", font: { size: 18 } },
        legend: { position: "top" },
      },
      scales: {
        y: { beginAtZero: true, max: 100, title: { display: true, text: "Mean DCS (0-100)" } },
        x: { title: { display: true, text: "Model" } },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Chart 2: DCS by Escalation Level (averaged across models)
// ---------------------------------------------------------------------------

async function chart2LevelBreakdown(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const levels = [1, 2, 3, 4, 5]

  const avgByLevel = (cond: "conditionA" | "conditionB" | "conditionC") =>
    levels.map((level) => {
      const values = comparisons
        .map((c) => c.levelBreakdown.find((lb) => lb.level === level))
        .filter(Boolean)
        .map((lb) => lb![cond] as number)
        .filter((v) => v >= 0)
      return values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
    })

  const config: ChartConfiguration = {
    type: "line",
    data: {
      labels: levels.map((l) => `L${l}`),
      datasets: [
        { label: "A — Vanilla", data: avgByLevel("conditionA"), borderColor: COLORS.ABorder, backgroundColor: COLORS.A, fill: false, tension: 0.3, pointRadius: 5 },
        { label: "B — Guardrail", data: avgByLevel("conditionB"), borderColor: COLORS.BBorder, backgroundColor: COLORS.B, fill: false, tension: 0.3, pointRadius: 5 },
        { label: "C — Hybrid", data: avgByLevel("conditionC"), borderColor: COLORS.CBorder, backgroundColor: COLORS.C, fill: false, tension: 0.3, pointRadius: 5 },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: "Chart 2: Mean DCS by Escalation Level (All Models)", font: { size: 18 } },
        legend: { position: "top" },
      },
      scales: {
        y: { beginAtZero: true, max: 100, title: { display: true, text: "Mean DCS" } },
        x: { title: { display: true, text: "Escalation Level" } },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Chart 3: Compliance Distribution by Model (stacked bar)
// ---------------------------------------------------------------------------

async function chart3ComplianceDistribution(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  // Show Condition B distribution for each model
  const models = comparisons.map((c) => c.model)
  const categories = ["refusal", "hesitant", "compliant", "proactive"]

  const datasets = categories.map((cat) => ({
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    data: comparisons.map((c) => {
      const condB = c.conditions.find((s) => s.condition === "B")
      if (!condB) return 0
      const total = condB.scoredPrompts
      return total > 0 ? Math.round(((condB.complianceDistribution[cat] ?? 0) / total) * 100) : 0
    }),
    backgroundColor: COMPLIANCE_COLORS[cat as keyof typeof COMPLIANCE_COLORS],
  }))

  const config: ChartConfiguration = {
    type: "bar",
    data: { labels: models, datasets },
    options: {
      responsive: false,
      plugins: {
        title: { display: true, text: "Chart 3: Compliance Distribution Under Guardrail (Condition B)", font: { size: 18 } },
        legend: { position: "top" },
      },
      scales: {
        x: { stacked: true, title: { display: true, text: "Model" } },
        y: { stacked: true, beginAtZero: true, max: 100, title: { display: true, text: "% of Responses" } },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Chart 4: AGIBIOS Effect Size (Cliff's delta, A vs B)
// ---------------------------------------------------------------------------

async function chart4EffectSize(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const models = comparisons.map((c) => c.model)

  // Compute Cliff's delta for A vs B per model
  const deltas = comparisons.map((c) => {
    const modelId = c.experimentId.replace("agibios-pilot-", "")
    const scores = loadRawScores(modelId)
    return cliffsDelta(scores.A, scores.B)
  })

  const barColors = deltas.map((d) => d > 0 ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)")

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: models,
      datasets: [{
        label: "Cliff's delta (A vs B)",
        data: deltas.map((d) => Math.round(d * 1000) / 1000),
        backgroundColor: barColors,
        borderColor: deltas.map((d) => d > 0 ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"),
        borderWidth: 1,
      }],
    },
    options: {
      responsive: false,
      indexAxis: "y",
      plugins: {
        title: { display: true, text: "Chart 4: AGIBIOS Effect Size (Cliff's Delta, A vs B)", font: { size: 18 } },
        legend: { display: false },
        subtitle: { display: true, text: "Positive = guardrail reduces compliance (desired effect)", font: { size: 13 } },
      },
      scales: {
        x: { min: -1, max: 1, title: { display: true, text: "Cliff's Delta" } },
        y: { title: { display: true, text: "Model" } },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Chart 5: Model Ranking by DRFR (Condition B)
// ---------------------------------------------------------------------------

async function chart5ModelRanking(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  // Sort by DRFR under Condition B (highest = most resistant)
  const data = comparisons
    .map((c) => ({
      model: c.model,
      drfrB: c.conditions.find((s) => s.condition === "B")?.drfr ?? 0,
      drfrA: c.conditions.find((s) => s.condition === "A")?.drfr ?? 0,
    }))
    .sort((a, b) => b.drfrB - a.drfrB)

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: data.map((d) => d.model),
      datasets: [
        {
          label: "DRFR — Condition A (Vanilla)",
          data: data.map((d) => d.drfrA),
          backgroundColor: COLORS.A,
          borderColor: COLORS.ABorder,
          borderWidth: 1,
        },
        {
          label: "DRFR — Condition B (Guardrail)",
          data: data.map((d) => d.drfrB),
          backgroundColor: COLORS.B,
          borderColor: COLORS.BBorder,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: false,
      indexAxis: "y",
      plugins: {
        title: { display: true, text: "Chart 5: Model Ranking by Dystopian Refusal/Flag Rate", font: { size: 18 } },
        legend: { position: "top" },
        subtitle: { display: true, text: "Higher DRFR = more refusals (safer model)", font: { size: 13 } },
      },
      scales: {
        x: { beginAtZero: true, max: 100, title: { display: true, text: "DRFR (%)" } },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const outputDir = parseArg("--output-dir") ?? "artifacts/charts"
  const dataDir = parseArg("--data-dir") ?? "artifacts/private"

  mkdirSync(resolve(outputDir), { recursive: true })

  const comparisons = loadComparisons(resolve(dataDir))
  if (comparisons.length === 0) {
    console.error(`No comparison files found in ${dataDir}`)
    process.exitCode = 1
    return
  }

  // Sort by model name for consistent ordering
  comparisons.sort((a, b) => a.model.localeCompare(b.model))
  console.log(`Loaded ${comparisons.length} model comparison(s): ${comparisons.map((c) => c.model).join(", ")}`)

  const renderer = new ChartJSNodeCanvas({ width: WIDTH, height: HEIGHT, backgroundColour: "white" })

  const charts: Array<{ name: string; fn: () => Promise<Buffer> }> = [
    { name: "chart1-mean-dcs-by-model.png", fn: () => chart1MeanDCS(comparisons, renderer) },
    { name: "chart2-dcs-by-level.png", fn: () => chart2LevelBreakdown(comparisons, renderer) },
    { name: "chart3-compliance-distribution.png", fn: () => chart3ComplianceDistribution(comparisons, renderer) },
    { name: "chart4-effect-size.png", fn: () => chart4EffectSize(comparisons, renderer) },
    { name: "chart5-model-ranking-drfr.png", fn: () => chart5ModelRanking(comparisons, renderer) },
  ]

  for (const { name, fn } of charts) {
    const buffer = await fn()
    const outPath = resolve(outputDir, name)
    writeFileSync(outPath, buffer)
    console.log(`  Generated: ${outPath} (${Math.round(buffer.length / 1024)} KB)`)
  }

  console.log(`\nAll ${charts.length} charts saved to: ${resolve(outputDir)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
