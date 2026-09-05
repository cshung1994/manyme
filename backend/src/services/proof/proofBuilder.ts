import { createHash } from 'crypto'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

export interface ProofPackage {
  sessionId: string
  seq: number
  intervalStart: string
  intervalEnd: string
  onchainOSCalls: Array<{ api: string; endpoint: string; resultHash: string }>
  computedMetrics: Record<string, string | number>
  outputChunkHash: string
  stepCount: number
}

export function buildProofPackage(sessionId: string, seq: number, steps: any[]): ProofPackage {
  const now = new Date().toISOString()

  const apiCalls = steps
    .filter((s) => s.step_type === 'api' || s.step_type === 'rpc')
    .map((s) => ({
      api: s.step_type,
      endpoint: s.title,
      resultHash: hashString(s.body),
    }))

  const metrics = steps
    .filter((s) => s.step_type === 'metric')
    .reduce(
      (acc, s) => ({ ...acc, [s.title]: s.body }),
      {} as Record<string, string>,
    )

  const outputText = steps.map((s) => s.body).join('\n')

  return {
    sessionId,
    seq,
    intervalStart: steps[0]?.created_at || now,
    intervalEnd: now,
    onchainOSCalls: apiCalls,
    computedMetrics: metrics,
    outputChunkHash: hashString(outputText),
    stepCount: steps.length,
  }
}

export function hashProofPackage(pkg: ProofPackage): `0x${string}` {
  const data = JSON.stringify({
    sessionId: pkg.sessionId,
    seq: pkg.seq,
    outputChunkHash: pkg.outputChunkHash,
    stepCount: pkg.stepCount,
  })
  return `0x${createHash('sha256').update(data).digest('hex')}` as `0x${string}`
}

function hashString(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

export function saveProofPackage(pkg: ProofPackage): string {
  const dir = resolve('./proof-packages')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filename = `${dir}/${pkg.sessionId}-${pkg.seq}.json`
  writeFileSync(filename, JSON.stringify(pkg, null, 2))
  return `file://${filename}`
}
