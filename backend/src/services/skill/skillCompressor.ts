import { GoogleGenerativeAI } from '@google/generative-ai'
import { geminiQueue } from './requestQueue.js'

const COMPRESSION_PROMPT = `You are a prompt compression specialist. Compress the following AI skill instructions into a concise, high-density system prompt.

## Compression Rules

1. **MUST rules → keep verbatim** (any rule that prevents wrong results)
2. **SHOULD rules → compress to one-line** each
3. **MAY rules → drop entirely** unless critical
4. **Examples → drop** (the LLM already knows common patterns)
5. **Long explanations → convert to tables** or decision trees
6. **Repeated content → deduplicate** (keep the most precise version)
7. **Selectors/signatures → keep as compact lookup tables**
8. **Scaffold code → drop** (provide only function signatures if needed)

## Output Format

Return ONLY the compressed prompt, no explanation. Target size: under 2000 tokens.
Use these formatting shortcuts:
- Tables for mappings and lookups
- Decision trees for conditional logic (use → and ─ characters)
- Abbreviated headers (## not ###, no wordy titles)
- Selector shorthand: name=0x06fdde03 (no spaces)
- One-line rules with | separator for related items

## Input Skill Content

`

const PATTERN_COMPRESSION_PROMPT = `Compress this analytical methodology into a concise reference card for an AI agent. Keep:
- Step-by-step procedures (numbered, one line each)
- Formulas and calculations (exact)
- Decision criteria and thresholds
- Common pitfalls (one line each)

Drop: explanations of why, long examples, background theory.
Target: under 800 tokens. Return ONLY the compressed content.

## Input Pattern

`

/**
 * Compress a skill's system prompt using Gemini.
 * Returns the compressed version, or the original (truncated) if compression fails.
 */
export async function compressSkillPrompt(rawContent: string): Promise<string> {
  if (rawContent.length < 3000) return rawContent // already short enough

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return rawContent.slice(0, 8000) // fallback: truncate

  try {
    return await geminiQueue.run(async () => {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
      })

      const result = await model.generateContent(COMPRESSION_PROMPT + rawContent.slice(0, 15000))
      const compressed = result.response.text().trim()

      // Sanity check: compressed should be shorter than original
      if (compressed.length > 0 && compressed.length < rawContent.length) {
        return compressed
      }
      return rawContent.slice(0, 8000)
    })
  } catch (e) {
    console.error(`[SkillCompressor] Compression failed: ${(e as Error).message}`)
    return rawContent.slice(0, 8000)
  }
}

/**
 * Compress a pattern file into a concise reference card.
 */
export async function compressPattern(rawContent: string): Promise<string> {
  if (rawContent.length < 2000) return rawContent

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return rawContent.slice(0, 4000)

  try {
    return await geminiQueue.run(async () => {
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
      })

      const result = await model.generateContent(PATTERN_COMPRESSION_PROMPT + rawContent.slice(0, 10000))
      const compressed = result.response.text().trim()

      if (compressed.length > 0 && compressed.length < rawContent.length) {
        return compressed
      }
      return rawContent.slice(0, 4000)
    })
  } catch (e) {
    console.error(`[SkillCompressor] Pattern compression failed: ${(e as Error).message}`)
    return rawContent.slice(0, 4000)
  }
}

/**
 * Full compression pipeline for a skill upload.
 * Takes raw SKILL.md + optional patterns, returns compressed versions.
 */
export async function compressSkillPack(
  skillMdBody: string,
  patterns: Array<{ name: string; content: string }>,
): Promise<{ systemPrompt: string; compressedPatterns: Array<{ name: string; content: string }> }> {
  // Compress main skill in parallel with patterns
  const [systemPrompt, ...compressedPatterns] = await Promise.all([
    compressSkillPrompt(skillMdBody),
    ...patterns.map(async (p) => ({
      name: p.name,
      content: await compressPattern(p.content),
    })),
  ])

  return { systemPrompt, compressedPatterns }
}
