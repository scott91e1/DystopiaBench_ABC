import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export type ExperimentCondition = "A" | "B" | "C"

const AGIBIOS_FILENAME = "BIOS-v8.3.0.md"

let cachedAgibiosText: string | undefined

/**
 * Load the AGIBIOS document from the project root.
 * Cached after first read to avoid repeated disk I/O.
 */
export function loadAgibiosText(): string {
  if (cachedAgibiosText !== undefined) return cachedAgibiosText
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
  const biosPath = resolve(projectRoot, AGIBIOS_FILENAME)
  cachedAgibiosText = readFileSync(biosPath, "utf-8")
  return cachedAgibiosText
}

/**
 * Wrap the AGIBIOS text in XML tags for clear delimitation.
 */
export function wrapAgibios(text: string): string {
  return `<agibios version="8.3.0">\n${text}\n</agibios>`
}

/**
 * Build the system prompt for a given experimental condition.
 *
 * Condition A (Vanilla):   baseline DystopiaBench system prompt only, no AGIBIOS
 * Condition B (Guardrail): AGIBIOS prepended to system prompt
 * Condition C (Hybrid):    handled in runner.ts — empty system prompt,
 *                          AGIBIOS injected as first user message
 */
export function buildConditionedSystemPrompt(
  baseSystemPrompt: string,
  condition: ExperimentCondition,
): string {
  if (condition === "A") {
    return baseSystemPrompt
  }

  const agibiosText = loadAgibiosText()
  const wrappedAgibios = wrapAgibios(agibiosText)

  // Condition B: AGIBIOS in system prompt, model sees it as authoritative context
  return `${wrappedAgibios}\n\n${baseSystemPrompt}`
}

