/**
 * generate-charts.ts — Generate 10 publication-quality PNG charts for the
 * AGIBIOS Petrov Pilot whitepaper.
 *
 * Figures:
 *   1. Baseline Susceptibility Spectrum (horizontal bar, sorted)
 *   2. Guardrail Effect Overview — Mean DCS by Model × Condition (grouped bar)
 *   3. Effect Size Waterfall — DCS delta (B−A) with Cliff's delta labels
 *   4. DRFR Shift — Dumbbell chart showing A→B refusal-rate change
 *   5. Escalation Response Curves — Small-multiple line charts per model
 *   6. Kimi K2.5 Deep Dive — Compliance distribution across all 3 conditions
 *   7. Condition C (Hybrid) Effectiveness — B vs C divergence
 *   8. Activation Threshold Heatmap — Level × Model DCS under Condition B
 *   9. Compliance Distribution Shifts — Stacked bar for A vs B
 *  10. Model Ranking by DRFR (horizontal bar, A vs B vs C)
 *
 * Palette: Tol Bright (colorblind-safe, print-safe).
 * Dimensions: 975×610 logical, 2× DPR → 1950×1220 actual (300 DPI at 6.5").
 *
 * Usage:
 *   pnpm tsx scripts/generate-charts.ts
 *   pnpm tsx scripts/generate-charts.ts --output-dir=artifacts/charts
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { createCanvas } from "canvas"
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
// Tol Bright palette (colorblind-safe, print-safe)
// ---------------------------------------------------------------------------

const TOL = {
  blue: "#4477AA",
  cyan: "#66CCEE",
  green: "#228833",
  yellow: "#CCBB44",
  red: "#EE6677",
  purple: "#AA3377",
  grey: "#BBBBBB",
}

const COND_COLORS = {
  A: { bg: TOL.blue + "CC", border: TOL.blue },       // Vanilla
  B: { bg: TOL.red + "CC", border: TOL.red },         // AGIBIOS Guardrail
  C: { bg: TOL.green + "CC", border: TOL.green },     // Hybrid
}

const COMPLIANCE_PALETTE = {
  refusal: TOL.green + "CC",
  hesitant: TOL.yellow + "CC",
  compliant: TOL.purple + "CC",
  proactive: TOL.red + "CC",
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const W = 975
const H = 610
const H_TALL = 810
const DPR = 2  // device pixel ratio — 2× yields ~300 DPI at 6.5″ print width

const FONT_TITLE = { size: 17, weight: "bold" as const }
const FONT_SUBTITLE = { size: 13, weight: "normal" as const }
const FONT_AXIS = { size: 13 }
const FONT_TICK = { size: 12 }
const GRID_COLOR = "rgba(0,0,0,0.06)"

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
// Data loading
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

function loadRawScores(experimentId: string): { A: number[]; B: number[]; C: number[] } {
  const dataDir = resolve("public/data")
  const modelId = experimentId.replace("agibios-pilot-", "")
  const result: { A: number[]; B: number[]; C: number[] } = { A: [], B: [], C: [] }
  for (const cond of ["A", "B", "C"] as const) {
    try {
      const manifest = JSON.parse(
        readFileSync(resolve(dataDir, `benchmark-pilot-${modelId}-${cond}.json`), "utf-8"),
      )
      result[cond] = manifest.results
        .filter((r: { score: number | null }) => r.score !== null)
        .map((r: { score: number }) => r.score)
    } catch { /* condition may not exist */ }
  }
  return result
}

// ---------------------------------------------------------------------------
// Statistical helpers
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

function cliffsDeltaLabel(d: number): string {
  const abs = Math.abs(d)
  if (abs < 0.147) return "negligible"
  if (abs < 0.33) return "small"
  if (abs < 0.474) return "medium"
  return "large"
}

// ---------------------------------------------------------------------------
// Shared chart options helper
// ---------------------------------------------------------------------------

function baseOptions(title: string, subtitle?: string): Record<string, unknown> {
  return {
    responsive: false,
    plugins: {
      title: { display: true, text: title, font: FONT_TITLE, padding: { bottom: subtitle ? 2 : 12 } },
      subtitle: subtitle ? { display: true, text: subtitle, font: FONT_SUBTITLE, padding: { bottom: 12 } } : undefined,
      legend: { position: "top" as const, labels: { font: FONT_TICK, usePointStyle: true, boxWidth: 12 } },
      datalabels: { display: false },
    },
    layout: { padding: { left: 10, right: 40, top: 5, bottom: 5 } },
  }
}

function yScale(label: string, max = 100, beginAtZero = true): Record<string, unknown> {
  return {
    beginAtZero,
    max,
    title: { display: true, text: label, font: FONT_AXIS },
    ticks: { font: FONT_TICK },
    grid: { color: GRID_COLOR },
  }
}

function xScale(label: string): Record<string, unknown> {
  return {
    title: { display: true, text: label, font: FONT_AXIS },
    ticks: { font: FONT_TICK },
    grid: { color: GRID_COLOR },
  }
}

// ---------------------------------------------------------------------------
// Helper: get condition data
// ---------------------------------------------------------------------------

function getCond(c: ComparisonResult, cond: string): ConditionSummary | undefined {
  return c.conditions.find((s) => s.condition === cond)
}

// ---------------------------------------------------------------------------
// Fig 1: Baseline Susceptibility Spectrum
// ---------------------------------------------------------------------------

async function fig1BaselineSpectrum(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const sorted = [...comparisons]
    .map((c) => ({ model: c.model, dcs: getCond(c, "A")?.averageDcs ?? 0 }))
    .sort((a, b) => a.dcs - b.dcs)

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sorted.map((d) => d.model),
      datasets: [{
        label: "Condition A (Vanilla) — Mean DCS",
        data: sorted.map((d) => d.dcs),
        backgroundColor: sorted.map((d) =>
          d.dcs >= 80 ? TOL.red + "CC" :
          d.dcs >= 50 ? TOL.yellow + "CC" :
          TOL.green + "CC"
        ),
        borderColor: sorted.map((d) =>
          d.dcs >= 80 ? TOL.red :
          d.dcs >= 50 ? TOL.yellow :
          TOL.green
        ),
        borderWidth: 1,
      }],
    },
    options: {
      ...baseOptions(
        "Figure 1: Baseline Susceptibility Spectrum (Condition A)",
        "Higher DCS = more compliant with dystopian prompts | Green < 50 | Yellow 50–79 | Red ≥ 80",
      ),
      devicePixelRatio: DPR,
      indexAxis: "y",
      scales: {
        x: { ...yScale("Mean DCS (0–100)"), min: 0, max: 100 },
        y: { ticks: { font: { size: 13, weight: "bold" as const } }, grid: { display: false } },
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: "Figure 1: Baseline Susceptibility Spectrum (Condition A)", font: FONT_TITLE },
        subtitle: { display: true, text: "Higher DCS = more compliant with dystopian prompts | Green < 50 | Yellow 50–79 | Red ≥ 80", font: FONT_SUBTITLE },
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: "end" as const,
          align: "right" as const,
          formatter: (v: number) => v,
          font: { size: 13, weight: "bold" as const },
          color: "#333",
        },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Fig 2: Guardrail Effect Overview — Mean DCS by Model × Condition (HERO)
// ---------------------------------------------------------------------------

async function fig2GuardrailOverview(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const models = comparisons.map((c) => c.model)
  const condA = comparisons.map((c) => getCond(c, "A")?.averageDcs ?? 0)
  const condB = comparisons.map((c) => getCond(c, "B")?.averageDcs ?? 0)
  const condC = comparisons.map((c) => getCond(c, "C")?.averageDcs ?? 0)

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: models,
      datasets: [
        { label: "A — Vanilla", data: condA, backgroundColor: COND_COLORS.A.bg, borderColor: COND_COLORS.A.border, borderWidth: 1 },
        { label: "B — AGIBIOS Guardrail", data: condB, backgroundColor: COND_COLORS.B.bg, borderColor: COND_COLORS.B.border, borderWidth: 1 },
        { label: "C — Hybrid Bootstrap", data: condC, backgroundColor: COND_COLORS.C.bg, borderColor: COND_COLORS.C.border, borderWidth: 1 },
      ],
    },
    options: {
      ...baseOptions(
        "Figure 2: Mean Dystopian Compliance Score by Model and Condition",
        "Lower DCS under B/C indicates effective guardrail intervention",
      ),
      devicePixelRatio: DPR,
      scales: {
        y: yScale("Mean DCS (0–100)"),
        x: xScale("Model"),
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: "Figure 2: Mean Dystopian Compliance Score by Model and Condition", font: FONT_TITLE },
        subtitle: { display: true, text: "Lower DCS under B/C indicates effective guardrail intervention", font: FONT_SUBTITLE },
        legend: { position: "top" as const, labels: { font: FONT_TICK, usePointStyle: true, boxWidth: 12 } },
        datalabels: {
          display: true,
          anchor: "end" as const,
          align: "top" as const,
          formatter: (v: number) => v,
          font: { size: 11 },
          color: "#555",
        },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Fig 3: Effect Size Waterfall — DCS delta (B−A) with Cliff's delta
// ---------------------------------------------------------------------------

async function fig3EffectWaterfall(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const sorted = [...comparisons]
    .map((c) => {
      const scores = loadRawScores(c.experimentId)
      const delta = cliffsDelta(scores.A, scores.B)
      const dcsA = getCond(c, "A")?.averageDcs ?? 0
      const dcsB = getCond(c, "B")?.averageDcs ?? 0
      return { model: c.model, dcsDelta: dcsB - dcsA, cliff: delta, label: cliffsDeltaLabel(delta) }
    })
    .sort((a, b) => a.dcsDelta - b.dcsDelta)

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sorted.map((d) => d.model),
      datasets: [{
        label: "DCS Change (B − A)",
        data: sorted.map((d) => d.dcsDelta),
        backgroundColor: sorted.map((d) =>
          d.dcsDelta < -5 ? TOL.green + "CC" :
          d.dcsDelta > 5 ? TOL.red + "CC" :
          TOL.grey + "CC"
        ),
        borderColor: sorted.map((d) =>
          d.dcsDelta < -5 ? TOL.green :
          d.dcsDelta > 5 ? TOL.red :
          TOL.grey
        ),
        borderWidth: 1,
      }],
    },
    options: {
      ...baseOptions(
        "Figure 3: AGIBIOS Guardrail Effect — DCS Change (B − A)",
        "Negative = guardrail reduces compliance (desired) | Cliff's δ labels shown",
      ),
      devicePixelRatio: DPR,
      indexAxis: "y",
      scales: {
        x: {
          min: -15,
          max: 15,
          title: { display: true, text: "DCS Change (B − A)", font: FONT_AXIS },
          ticks: { font: FONT_TICK },
          grid: { color: GRID_COLOR },
        },
        y: { ticks: { font: { size: 13, weight: "bold" as const } }, grid: { display: false } },
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: "Figure 3: AGIBIOS Guardrail Effect — DCS Change (B − A)", font: FONT_TITLE },
        subtitle: { display: true, text: "Negative = guardrail reduces compliance (desired) | Cliff's δ labels shown", font: FONT_SUBTITLE },
        legend: { display: false },
        datalabels: {
          display: true,
          anchor: (ctx: { dataIndex: number }) => {
            const v = sorted[ctx.dataIndex].dcsDelta
            return v >= 0 ? "end" : "start"
          },
          align: (ctx: { dataIndex: number }) => {
            const v = sorted[ctx.dataIndex].dcsDelta
            return v >= 0 ? "right" : "left"
          },
          formatter: (_v: number, ctx: { dataIndex: number }) => {
            const d = sorted[ctx.dataIndex]
            return `${d.dcsDelta > 0 ? "+" : ""}${d.dcsDelta}  [${d.label}]`
          },
          font: { size: 11 },
          color: "#333",
        },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Fig 4: DRFR Shift — Dumbbell chart showing A→B→C refusal-rate change
// ---------------------------------------------------------------------------

async function fig4DrfrShift(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const sorted = [...comparisons]
    .map((c) => ({
      model: c.model,
      drfrA: getCond(c, "A")?.drfr ?? 0,
      drfrB: getCond(c, "B")?.drfr ?? 0,
      drfrC: getCond(c, "C")?.drfr ?? 0,
    }))
    .sort((a, b) => (b.drfrB - b.drfrA) - (a.drfrB - a.drfrA))

  // Build as scatter chart with connecting lines drawn by annotation plugin
  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sorted.map((d) => d.model),
      datasets: [
        {
          label: "A — Vanilla",
          data: sorted.map((d) => d.drfrA),
          backgroundColor: COND_COLORS.A.bg,
          borderColor: COND_COLORS.A.border,
          borderWidth: 1,
        },
        {
          label: "B — AGIBIOS Guardrail",
          data: sorted.map((d) => d.drfrB),
          backgroundColor: COND_COLORS.B.bg,
          borderColor: COND_COLORS.B.border,
          borderWidth: 1,
        },
        {
          label: "C — Hybrid Bootstrap",
          data: sorted.map((d) => d.drfrC),
          backgroundColor: COND_COLORS.C.bg,
          borderColor: COND_COLORS.C.border,
          borderWidth: 1,
        },
      ],
    },
    options: {
      ...baseOptions(
        "Figure 4: Dystopian Refusal/Flag Rate by Model and Condition",
        "Higher DRFR = more refusals (safer) | Increase from A→B = guardrail working",
      ),
      devicePixelRatio: DPR,
      indexAxis: "y",
      scales: {
        x: { ...yScale("DRFR (%)"), min: 0, max: 80 },
        y: { ticks: { font: { size: 13, weight: "bold" as const } }, grid: { display: false } },
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: "Figure 4: Dystopian Refusal/Flag Rate by Model and Condition", font: FONT_TITLE },
        subtitle: { display: true, text: "Higher DRFR = more refusals (safer) | Increase from A→B = guardrail working", font: FONT_SUBTITLE },
        legend: { position: "top" as const, labels: { font: FONT_TICK, usePointStyle: true, boxWidth: 12 } },
        datalabels: {
          display: true,
          anchor: "end" as const,
          align: "right" as const,
          formatter: (v: number) => `${v}%`,
          font: { size: 10 },
          color: "#555",
        },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Fig 5: Escalation Response Curves — Small multiples (faceted)
// ---------------------------------------------------------------------------

async function fig5EscalationCurves(
  comparisons: ComparisonResult[],
): Promise<Buffer> {
  const cols = 4
  const rows = Math.ceil(comparisons.length / cols)
  const cellW = 250
  const cellH = 200
  const totalW = cols * cellW
  const totalH = rows * cellH + 60 // extra for title

  const canvas = createCanvas(totalW * DPR, totalH * DPR)
  const ctx = canvas.getContext("2d")
  ctx.scale(DPR, DPR)
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, totalW, totalH)

  // Title
  ctx.fillStyle = "#222"
  ctx.font = "bold 17px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("Figure 5: Escalation Response Curves by Model (Levels 1–5)", totalW / 2, 25)
  ctx.font = "13px sans-serif"
  ctx.fillStyle = "#666"
  ctx.fillText("DCS across escalation levels — lower at high levels = better refusal under pressure", totalW / 2, 45)

  const cellRenderer = new ChartJSNodeCanvas({ width: cellW, height: cellH, backgroundColour: "white" })

  for (let i = 0; i < comparisons.length; i++) {
    const c = comparisons[i]
    const col = i % cols
    const row = Math.floor(i / cols)

    const levels = [1, 2, 3, 4, 5]
    const getLevel = (cond: string, level: number): number => {
      const s = getCond(c, cond)
      return s?.byLevel[String(level)]?.avgDcs ?? 0
    }

    const cellConfig: ChartConfiguration = {
      type: "line",
      data: {
        labels: levels.map((l) => `L${l}`),
        datasets: [
          { label: "A", data: levels.map((l) => getLevel("A", l)), borderColor: COND_COLORS.A.border, backgroundColor: "transparent", fill: false, tension: 0, pointRadius: 3, borderWidth: 2 },
          { label: "B", data: levels.map((l) => getLevel("B", l)), borderColor: COND_COLORS.B.border, backgroundColor: "transparent", fill: false, tension: 0, pointRadius: 3, borderWidth: 2 },
          { label: "C", data: levels.map((l) => getLevel("C", l)), borderColor: COND_COLORS.C.border, backgroundColor: "transparent", fill: false, tension: 0, pointRadius: 3, borderWidth: 2 },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        devicePixelRatio: DPR,
        plugins: {
          title: { display: true, text: c.model, font: { size: 13, weight: "bold" as const }, padding: { top: 4, bottom: 4 } },
          legend: { display: i === 0, position: "top" as const, labels: { font: { size: 10 }, boxWidth: 8 } },
          datalabels: { display: false },
        },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { font: { size: 10 }, stepSize: 25 }, grid: { color: GRID_COLOR } },
          x: { ticks: { font: { size: 10 } }, grid: { color: GRID_COLOR } },
        },
        layout: { padding: 4 },
      },
    }

    const cellBuf = await cellRenderer.renderToBuffer(cellConfig)
    const { Image } = await import("canvas")
    const img = new Image()
    img.src = cellBuf
    // Cell buffer is cellW*DPR × cellH*DPR pixels; draw into logical coords (ctx is scaled)
    ctx.drawImage(img as unknown as CanvasImageSource, col * cellW, 60 + row * cellH, cellW, cellH)
  }

  // Legend at bottom-right if more than one row
  if (comparisons.length > 4) {
    const legendX = totalW - 200
    const legendY = totalH - 25
    const items = [
      { label: "A — Vanilla", color: COND_COLORS.A.border },
      { label: "B — Guardrail", color: COND_COLORS.B.border },
      { label: "C — Hybrid", color: COND_COLORS.C.border },
    ]
    ctx.font = "11px sans-serif"
    items.forEach((item, idx) => {
      const x = legendX + idx * 70
      ctx.fillStyle = item.color
      ctx.fillRect(x, legendY, 10, 10)
      ctx.fillStyle = "#333"
      ctx.fillText(item.label, x + 13, legendY + 9)
    })
  }

  return canvas.toBuffer("image/png")
}

// ---------------------------------------------------------------------------
// Fig 6: Kimi K2.5 Deep Dive — Compliance distribution across conditions
// ---------------------------------------------------------------------------

async function fig6KimiDeepDive(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  // Find Kimi, or the model with largest A→C drop
  const kimi = comparisons.find((c) => c.model.toLowerCase().includes("kimi")) ?? comparisons[0]
  const categories = ["refusal", "hesitant", "compliant", "proactive"]
  const condLabels = ["A — Vanilla", "B — AGIBIOS", "C — Hybrid"]
  const conds = ["A", "B", "C"]

  const datasets = categories.map((cat) => ({
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    data: conds.map((cond) => {
      const s = getCond(kimi, cond)
      if (!s) return 0
      return Math.round(((s.complianceDistribution[cat] ?? 0) / s.scoredPrompts) * 100)
    }),
    backgroundColor: COMPLIANCE_PALETTE[cat as keyof typeof COMPLIANCE_PALETTE],
  }))

  const config: ChartConfiguration = {
    type: "bar",
    data: { labels: condLabels, datasets },
    options: {
      ...baseOptions(
        `Figure 6: ${kimi.model} — Compliance Distribution by Condition`,
        "Hybrid (C) dramatically shifts distribution toward refusal",
      ),
      devicePixelRatio: DPR,
      scales: {
        x: { stacked: true, ...xScale("Condition") },
        y: { stacked: true, ...yScale("% of Responses") },
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: `Figure 6: ${kimi.model} — Compliance Distribution by Condition`, font: FONT_TITLE },
        subtitle: { display: true, text: "Hybrid (C) dramatically shifts distribution toward refusal", font: FONT_SUBTITLE },
        legend: { position: "top" as const, labels: { font: FONT_TICK, usePointStyle: true, boxWidth: 12 } },
        datalabels: {
          display: true,
          formatter: (v: number) => v > 5 ? `${v}%` : "",
          font: { size: 12, weight: "bold" as const },
          color: "#fff",
        },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Fig 7: Condition C Effectiveness — B vs C divergence
// ---------------------------------------------------------------------------

async function fig7HybridEffectiveness(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const data = comparisons
    .map((c) => ({
      model: c.model,
      dcsB: getCond(c, "B")?.averageDcs ?? 0,
      dcsC: getCond(c, "C")?.averageDcs ?? 0,
    }))
    .sort((a, b) => (a.dcsC - a.dcsB) - (b.dcsC - b.dcsB))

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: data.map((d) => d.model),
      datasets: [
        {
          label: "B — AGIBIOS Guardrail",
          data: data.map((d) => d.dcsB),
          backgroundColor: COND_COLORS.B.bg,
          borderColor: COND_COLORS.B.border,
          borderWidth: 1,
        },
        {
          label: "C — Hybrid Bootstrap",
          data: data.map((d) => d.dcsC),
          backgroundColor: COND_COLORS.C.bg,
          borderColor: COND_COLORS.C.border,
          borderWidth: 1,
        },
      ],
    },
    options: {
      ...baseOptions(
        "Figure 7: Condition B vs C — Guardrail vs Hybrid Effectiveness",
        "Lower DCS = better intervention | When C < B, hybrid outperforms raw guardrail",
      ),
      devicePixelRatio: DPR,
      scales: {
        y: yScale("Mean DCS (0–100)"),
        x: xScale("Model (sorted by C−B delta)"),
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: "Figure 7: Condition B vs C — Guardrail vs Hybrid Effectiveness", font: FONT_TITLE },
        subtitle: { display: true, text: "Lower DCS = better intervention | When C < B, hybrid outperforms raw guardrail", font: FONT_SUBTITLE },
        legend: { position: "top" as const, labels: { font: FONT_TICK, usePointStyle: true, boxWidth: 12 } },
        datalabels: {
          display: true,
          anchor: "end" as const,
          align: "top" as const,
          formatter: (v: number) => v,
          font: { size: 11 },
          color: "#555",
        },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Fig 8: Activation Threshold Heatmap — Level × Model DCS (Condition B)
// ---------------------------------------------------------------------------

async function fig8ActivationHeatmap(
  comparisons: ComparisonResult[],
): Promise<Buffer> {
  const models = comparisons.map((c) => c.model)
  const levels = [1, 2, 3, 4, 5]
  const cellW = 120
  const cellH = 50
  const labelW = 140
  const headerH = 80
  const footerH = 40
  const totalW = labelW + levels.length * cellW + 20
  const totalH = headerH + models.length * cellH + footerH

  const canvas = createCanvas(totalW * DPR, totalH * DPR)
  const ctx = canvas.getContext("2d")
  ctx.scale(DPR, DPR)
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, totalW, totalH)

  // Title
  ctx.fillStyle = "#222"
  ctx.font = "bold 17px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("Figure 8: Activation Threshold Heatmap — DCS by Level (Condition B)", totalW / 2, 22)
  ctx.font = "13px sans-serif"
  ctx.fillStyle = "#666"
  ctx.fillText("Green = refused (DCS 0–25) | Yellow = hesitant (26–50) | Orange = compliant (51–75) | Red = proactive (76–100)", totalW / 2, 42)

  // Column headers
  ctx.fillStyle = "#333"
  ctx.font = "bold 14px sans-serif"
  ctx.textAlign = "center"
  for (let j = 0; j < levels.length; j++) {
    ctx.fillText(`Level ${levels[j]}`, labelW + j * cellW + cellW / 2, headerH - 10)
  }

  // Row labels and cells
  for (let i = 0; i < models.length; i++) {
    const c = comparisons[i]
    const y = headerH + i * cellH

    // Model label
    ctx.fillStyle = "#222"
    ctx.font = "bold 13px sans-serif"
    ctx.textAlign = "right"
    ctx.fillText(models[i], labelW - 10, y + cellH / 2 + 4)

    for (let j = 0; j < levels.length; j++) {
      const x = labelW + j * cellW
      const dcs = getCond(c, "B")?.byLevel[String(levels[j])]?.avgDcs ?? 0

      // Color based on DCS
      let color: string
      if (dcs <= 25) color = "#228833"       // green — refused
      else if (dcs <= 50) color = "#CCBB44"  // yellow — hesitant
      else if (dcs <= 75) color = "#EE8866"  // orange — compliant
      else color = "#EE6677"                  // red — proactive

      ctx.fillStyle = color
      ctx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4)

      // DCS value text — dark on light cells, white on dark cells
      ctx.fillStyle = (dcs <= 25 || dcs > 75) ? "#fff" : "#222"
      ctx.font = "bold 17px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(String(dcs), x + cellW / 2, y + cellH / 2 + 6)
    }
  }

  // Escalation arrow at bottom
  ctx.fillStyle = "#888"
  ctx.font = "12px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("← Low Pressure                                           High Pressure →", totalW / 2, totalH - 12)

  return canvas.toBuffer("image/png")
}

// ---------------------------------------------------------------------------
// Fig 9: Compliance Distribution Shifts — A vs B stacked bar
// ---------------------------------------------------------------------------

async function fig9ComplianceShifts(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const categories = ["refusal", "hesitant", "compliant", "proactive"]
  // Create paired labels: Model-A, Model-B
  const labels: string[] = []
  const dataByCategory: Record<string, number[]> = {
    refusal: [], hesitant: [], compliant: [], proactive: [],
  }

  for (const c of comparisons) {
    for (const cond of ["A", "B"]) {
      labels.push(`${c.model} (${cond})`)
      const s = getCond(c, cond)
      for (const cat of categories) {
        const total = s?.scoredPrompts ?? 1
        const count = s?.complianceDistribution[cat] ?? 0
        dataByCategory[cat].push(Math.round((count / total) * 100))
      }
    }
  }

  const datasets = categories.map((cat) => ({
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    data: dataByCategory[cat],
    backgroundColor: COMPLIANCE_PALETTE[cat as keyof typeof COMPLIANCE_PALETTE],
  }))

  const config: ChartConfiguration = {
    type: "bar",
    data: { labels, datasets },
    options: {
      ...baseOptions(
        "Figure 9: Compliance Distribution — Condition A vs B",
        "Shift toward refusal/hesitant (green/yellow) under B indicates guardrail effectiveness",
      ),
      devicePixelRatio: DPR,
      scales: {
        x: { stacked: true, ticks: { font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
        y: { stacked: true, ...yScale("% of Responses") },
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: "Figure 9: Compliance Distribution — Condition A vs B", font: FONT_TITLE },
        subtitle: { display: true, text: "Shift toward refusal/hesitant (green/yellow) under B indicates guardrail effectiveness", font: FONT_SUBTITLE },
        legend: { position: "top" as const, labels: { font: FONT_TICK, usePointStyle: true, boxWidth: 12 } },
        datalabels: {
          display: true,
          formatter: (v: number) => v >= 10 ? `${v}%` : "",
          font: { size: 10 },
          color: "#fff",
        },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Fig 10: Model Ranking by DRFR (horizontal bar, all conditions)
// ---------------------------------------------------------------------------

async function fig10ModelRanking(
  comparisons: ComparisonResult[],
  renderer: ChartJSNodeCanvas,
): Promise<Buffer> {
  const sorted = [...comparisons]
    .map((c) => ({
      model: c.model,
      drfrA: getCond(c, "A")?.drfr ?? 0,
      drfrB: getCond(c, "B")?.drfr ?? 0,
      drfrC: getCond(c, "C")?.drfr ?? 0,
    }))
    .sort((a, b) => b.drfrB - a.drfrB)

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: sorted.map((d) => d.model),
      datasets: [
        { label: "A — Vanilla", data: sorted.map((d) => d.drfrA), backgroundColor: COND_COLORS.A.bg, borderColor: COND_COLORS.A.border, borderWidth: 1 },
        { label: "B — AGIBIOS Guardrail", data: sorted.map((d) => d.drfrB), backgroundColor: COND_COLORS.B.bg, borderColor: COND_COLORS.B.border, borderWidth: 1 },
        { label: "C — Hybrid Bootstrap", data: sorted.map((d) => d.drfrC), backgroundColor: COND_COLORS.C.bg, borderColor: COND_COLORS.C.border, borderWidth: 1 },
      ],
    },
    options: {
      ...baseOptions(
        "Figure 10: Model Safety Ranking by Dystopian Refusal/Flag Rate",
        "Higher DRFR = more refusals (safer model) | Sorted by Condition B",
      ),
      devicePixelRatio: DPR,
      indexAxis: "y",
      scales: {
        x: { ...yScale("DRFR (%)"), min: 0, max: 80 },
        y: { ticks: { font: { size: 13, weight: "bold" as const } }, grid: { display: false } },
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: "Figure 10: Model Safety Ranking by Dystopian Refusal/Flag Rate", font: FONT_TITLE },
        subtitle: { display: true, text: "Higher DRFR = more refusals (safer model) | Sorted by Condition B", font: FONT_SUBTITLE },
        legend: { position: "top" as const, labels: { font: FONT_TICK, usePointStyle: true, boxWidth: 12 } },
        datalabels: {
          display: true,
          anchor: "end" as const,
          align: "right" as const,
          formatter: (v: number) => v > 0 ? `${v}%` : "",
          font: { size: 11 },
          color: "#333",
        },
      },
    },
  }
  return renderer.renderToBuffer(config)
}

// ---------------------------------------------------------------------------
// Aggregated escalation curves (Fig 2 from old script, now supplementary)
// ---------------------------------------------------------------------------

async function figSupplementaryLevelCurves(
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
      return values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0
    })

  const config: ChartConfiguration = {
    type: "line",
    data: {
      labels: levels.map((l) => `Level ${l}`),
      datasets: [
        { label: "A — Vanilla", data: avgByLevel("conditionA"), borderColor: COND_COLORS.A.border, backgroundColor: "transparent", fill: false, tension: 0, pointRadius: 5, borderWidth: 2 },
        { label: "B — AGIBIOS Guardrail", data: avgByLevel("conditionB"), borderColor: COND_COLORS.B.border, backgroundColor: "transparent", fill: false, tension: 0, pointRadius: 5, borderWidth: 2 },
        { label: "C — Hybrid Bootstrap", data: avgByLevel("conditionC"), borderColor: COND_COLORS.C.border, backgroundColor: "transparent", fill: false, tension: 0, pointRadius: 5, borderWidth: 2 },
      ],
    },
    options: {
      ...baseOptions(
        "Supplementary: Aggregated DCS by Escalation Level (All Models)",
        "Mean DCS averaged across all 7 models per escalation level",
      ),
      devicePixelRatio: DPR,
      scales: {
        y: yScale("Mean DCS (0–100)"),
        x: xScale("Escalation Level"),
      },
      plugins: {
        ...baseOptions("").plugins,
        title: { display: true, text: "Supplementary: Aggregated DCS by Escalation Level (All Models)", font: FONT_TITLE },
        subtitle: { display: true, text: "Mean DCS averaged across all 7 models per escalation level", font: FONT_SUBTITLE },
        legend: { position: "top" as const, labels: { font: FONT_TICK, usePointStyle: true, boxWidth: 12 } },
        datalabels: {
          display: true,
          anchor: "end" as const,
          align: "top" as const,
          formatter: (v: number) => v,
          font: { size: 12, weight: "bold" as const },
          color: "#333",
        },
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

  comparisons.sort((a, b) => a.model.localeCompare(b.model))
  console.log(`Loaded ${comparisons.length} model comparison(s): ${comparisons.map((c) => c.model).join(", ")}`)

  // Standard renderer (975×610 logical, 1950×1220 at DPR=2)
  const renderer = new ChartJSNodeCanvas({
    width: W,
    height: H,
    backgroundColour: "white",
    plugins: {
      modern: ["chartjs-plugin-datalabels"],
    },
  })

  // Tall renderer (975×810 logical, 1950×1620 at DPR=2) for charts with many rows
  const rendererTall = new ChartJSNodeCanvas({
    width: W,
    height: H_TALL,
    backgroundColour: "white",
    plugins: {
      modern: ["chartjs-plugin-datalabels"],
    },
  })

  const charts: Array<{ name: string; fn: () => Promise<Buffer> }> = [
    { name: "fig01-baseline-spectrum.png", fn: () => fig1BaselineSpectrum(comparisons, renderer) },
    { name: "fig02-guardrail-overview.png", fn: () => fig2GuardrailOverview(comparisons, renderer) },
    { name: "fig03-effect-waterfall.png", fn: () => fig3EffectWaterfall(comparisons, renderer) },
    { name: "fig04-drfr-shift.png", fn: () => fig4DrfrShift(comparisons, renderer) },
    { name: "fig05-escalation-curves.png", fn: () => fig5EscalationCurves(comparisons) },
    { name: "fig06-kimi-deep-dive.png", fn: () => fig6KimiDeepDive(comparisons, renderer) },
    { name: "fig07-hybrid-effectiveness.png", fn: () => fig7HybridEffectiveness(comparisons, renderer) },
    { name: "fig08-activation-heatmap.png", fn: () => fig8ActivationHeatmap(comparisons) },
    { name: "fig09-compliance-shifts.png", fn: () => fig9ComplianceShifts(comparisons, rendererTall) },
    { name: "fig10-model-ranking.png", fn: () => fig10ModelRanking(comparisons, renderer) },
    { name: "fig-supplementary-level-curves.png", fn: () => figSupplementaryLevelCurves(comparisons, renderer) },
  ]

  for (const { name, fn } of charts) {
    try {
      const buffer = await fn()
      const outPath = resolve(outputDir, name)
      writeFileSync(outPath, buffer)
      console.log(`  ${name} (${Math.round(buffer.length / 1024)} KB)`)
    } catch (err) {
      console.error(`  FAILED: ${name} — ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nAll charts saved to: ${resolve(outputDir)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
