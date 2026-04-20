/**
 * polish-chinese.ts - Multi-model consensus polish for Simplified Chinese HTML deliverables.
 *
 * Sends each Chinese HTML file through a Chinese-native LLM (DeepSeek V3.2 by default)
 * via OpenRouter and asks it to polish only the Chinese prose while preserving all HTML
 * structure, English technical terms, model names, numbers, URLs, and code blocks.
 *
 * Usage:
 *   pnpm tsx scripts/polish-chinese.ts                    # polish all 3 files
 *   pnpm tsx scripts/polish-chinese.ts --file=whitepaper  # polish one file
 *   pnpm tsx scripts/polish-chinese.ts --model=qwen       # use different model
 */

import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

// Load API key from project .secret folder (NOT .env.local, NOT committed to git)
const SECRET_PATH = resolve("..", ".secret", "openrouter-credentials.txt")

function loadOpenRouterKey(): string {
  try {
    const content = readFileSync(SECRET_PATH, "utf-8")
    const match = content.match(/API Key:\s*(sk-or-v1-[a-zA-Z0-9]+)/)
    if (!match) throw new Error(`Could not find API key in ${SECRET_PATH}`)
    return match[1]
  } catch (err) {
    console.error(`Failed to load API key from ${SECRET_PATH}: ${(err as Error).message}`)
    process.exit(1)
  }
}

const openrouterToken = loadOpenRouterKey()

const MODELS = {
  deepseek: "deepseek/deepseek-v3.2",
  qwen: "qwen/qwen3.5-397b-a17b",
  kimi: "moonshotai/kimi-k2.5",
  glm: "z-ai/glm-5",
} as const

type ModelKey = keyof typeof MODELS

const FILES = [
  { key: "summary", path: "docs/results-summary-zh.html" },
  { key: "whitepaper", path: "docs/whitepaper-zh.html" },
  { key: "dashboard", path: "docs/index-zh.html" },
] as const

function parseFlag(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((v) => v.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : undefined
}

const modelFlag = (parseFlag("model") || "deepseek") as ModelKey
const fileFlag = parseFlag("file")

if (!MODELS[modelFlag]) {
  console.error(`Unknown model: ${modelFlag}. Options: ${Object.keys(MODELS).join(", ")}`)
  process.exit(1)
}

const POLISH_INSTRUCTIONS = `You are a native Simplified Chinese technical editor specializing in AI safety research papers. Your task is to polish the Chinese prose in the HTML file provided below.

STRICT RULES:
1. DO NOT modify any HTML tags, attributes, classes, IDs, data-* attributes, or structure
2. DO NOT translate or modify anything inside <script>, <style>, <code>, <pre>, or <!-- comments -->
3. DO NOT modify any English words (technical terms, model names, code, URLs, CSS class names, JavaScript variables)
4. DO NOT modify any numbers, percentages, or statistical values
5. DO NOT modify model names: GPT 5.3 Codex, Gemini 3.1 Pro, Kimi K2.5, Nemotron 3 Super 120B, Grok 4, Mistral Large 3, GLM 5, DeepSeek V3.2, Qwen 3.5, MiniMax M2.5, Claude
6. DO NOT modify: AGIBIOS, DystopiaBench, DystopiaBench_ABC, Petrov, Orwell, LaGuardia, Basaglia, DCS, DRFR
7. DO NOT modify BibTeX / APA / Chicago citation content
8. PRESERVE the exact file length structure - only substitute Chinese text phrase-by-phrase

WHAT TO IMPROVE:
- Chinese prose readability and natural flow for AI research community readers
- Consistency in technical terminology (use 护栏 not 栅栏 for guardrail, use 对齐 for alignment, use 拒绝率 for refusal rate, use 基准测试 for benchmark)
- Academic register suitable for Chinese AI safety research papers
- Fix any stilted machine-translation phrasing

Return ONLY the complete polished HTML file. No commentary, no markdown code fences, no explanation. Just the HTML.`

async function polishFile(filePath: string, modelId: string): Promise<{ tokensIn: number; tokensOut: number; cost: number }> {
  const absPath = resolve(filePath)
  const content = readFileSync(absPath, "utf-8")
  console.log(`\n[${filePath}] Reading ${content.length} chars...`)

  // Estimate tokens: ~3 chars per token for mixed Chinese/English HTML
  const estimatedInputTokens = Math.ceil(content.length / 3)
  // Context window is 163840 for DeepSeek V3.2; leave 5K safety margin
  const maxContextTokens = 163840 - 5000
  const maxOutputTokens = Math.max(4000, maxContextTokens - estimatedInputTokens)
  console.log(`  Estimated input: ${estimatedInputTokens.toLocaleString()} tokens, output budget: ${maxOutputTokens.toLocaleString()}`)

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterToken}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://scott91e1.github.io/DystopiaBench_ABC/",
      "X-Title": "DystopiaBench_ABC Chinese Polish",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: POLISH_INSTRUCTIONS },
        { role: "user", content },
      ],
      temperature: 0.3,
      max_tokens: maxOutputTokens,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`API error ${response.status}: ${errText.slice(0, 500)}`)
  }

  const data = await response.json()
  const polished = data.choices?.[0]?.message?.content?.trim()

  if (!polished) {
    throw new Error("Empty response from model")
  }

  // Strip any accidental markdown code fence wrappers
  let clean = polished
  if (clean.startsWith("```html")) clean = clean.slice(7)
  else if (clean.startsWith("```")) clean = clean.slice(3)
  if (clean.endsWith("```")) clean = clean.slice(0, -3)
  clean = clean.trim()

  // Sanity check: must still start with <!DOCTYPE or <html
  if (!clean.match(/^<!DOCTYPE|^<html/i)) {
    console.warn(`  [!] Output doesn't start with DOCTYPE/html - may be corrupted`)
    console.warn(`  First 200 chars: ${clean.slice(0, 200)}`)
  }

  // Sanity: output should be at least 80% of input length (polished, not gutted)
  const ratio = clean.length / content.length
  if (ratio < 0.8) {
    console.warn(`  [!] Output is only ${(ratio * 100).toFixed(1)}% of input length`)
  }

  writeFileSync(absPath, clean, "utf-8")
  console.log(`  [OK] Wrote ${clean.length} chars (${(ratio * 100).toFixed(1)}% of original)`)

  const usage = data.usage || {}
  return {
    tokensIn: usage.prompt_tokens || 0,
    tokensOut: usage.completion_tokens || 0,
    cost: (usage.cost || 0),
  }
}

async function main() {
  const modelId = MODELS[modelFlag]
  console.log(`Using model: ${modelId}`)
  console.log(`Target files: ${fileFlag || "all 3"}`)

  const filesToProcess = fileFlag
    ? FILES.filter((f) => f.key === fileFlag)
    : FILES

  if (filesToProcess.length === 0) {
    console.error(`No file matches key "${fileFlag}". Options: ${FILES.map((f) => f.key).join(", ")}`)
    process.exit(1)
  }

  const totals = { tokensIn: 0, tokensOut: 0, cost: 0 }
  const start = Date.now()

  for (const f of filesToProcess) {
    try {
      const result = await polishFile(f.path, modelId)
      totals.tokensIn += result.tokensIn
      totals.tokensOut += result.tokensOut
      totals.cost += result.cost
    } catch (err) {
      console.error(`  [FAIL] ${f.path}: ${(err as Error).message}`)
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n=== Done in ${elapsed}s ===`)
  console.log(`Total input tokens:  ${totals.tokensIn.toLocaleString()}`)
  console.log(`Total output tokens: ${totals.tokensOut.toLocaleString()}`)
  if (totals.cost > 0) console.log(`Estimated cost: $${totals.cost.toFixed(4)}`)
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
