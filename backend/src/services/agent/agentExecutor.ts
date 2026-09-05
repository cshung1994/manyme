import { getDb } from '../../db/client.js'
import { randomUUID } from 'crypto'
import { GoogleGenerativeAI, FunctionCallingMode, type FunctionResponsePart } from '@google/generative-ai'
import { getAgentById, incrementRunCount } from './agentRegistry.js'
import { geminiQueue } from '../skill/requestQueue.js'
import { accrueCharge, getBalance } from '../session/billingService.js'
import { getToolDeclarations } from '../skill/toolDeclarations.js'
import { executeRpcTool } from '../skill/toolExecutor.js'
import { TOOL_USE_SYSTEM_PROMPT, buildToolUsePrompt } from '../skill/promptBuilder.js'
import type { AgentRow, AgentExecutionRow } from '../../types/index.js'

const MAX_TOOL_CALLS = parseInt(process.env.MAX_TOOL_CALLS_PER_EXECUTION || '50')
const DEFAULT_MODEL = 'gemini-2.5-flash'

interface StepEvent {
  kind: string
  title: string
  body: string
  ts: string
}

interface RunResult {
  executionId: string
  output: string
  durationMs: number
  tokensUsed: number | null
  toolCallCount: number
  status: 'completed' | 'failed'
  error?: string
}

function renderTemplate(template: string, inputs: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = inputs[key]
    return val !== undefined ? String(val) : `{{${key}}}`
  })
}

function validateInputs(agent: AgentRow, inputs: Record<string, unknown>): string | null {
  if (!agent.input_schema_json) return null
  try {
    const schema = JSON.parse(agent.input_schema_json)
    const required: string[] = schema.required || []
    for (const field of required) {
      if (inputs[field] === undefined || inputs[field] === '') {
        return `Missing required field: ${field}`
      }
    }
  } catch { /* skip validation */ }
  return null
}

function resolveModel(agent: AgentRow): string {
  return (agent.model && agent.model.startsWith('gemini')) ? agent.model : DEFAULT_MODEL
}

function hasToolUse(agent: AgentRow): boolean {
  return !!agent.tools_json
}

function getSystemPrompt(agent: AgentRow): string {
  if (hasToolUse(agent)) return TOOL_USE_SYSTEM_PROMPT
  return agent.system_prompt
}

function buildUserPrompt(agent: AgentRow, inputs: Record<string, unknown>): string {
  if (hasToolUse(agent)) {
    // Tool-use mode: structured prompt with reference injection
    const query = String(inputs.query || inputs._query || '')
    return buildToolUsePrompt(
      agent.user_prompt_template ? renderTemplate(agent.user_prompt_template, inputs) : query,
      inputs,
    )
  }

  // Standard mode: simple template rendering
  if (agent.user_prompt_template) {
    return renderTemplate(agent.user_prompt_template, inputs)
  }
  return Object.entries(inputs).map(([k, v]) => `${k}: ${v}`).join('\n')
}

// ─── Once mode ───────────────────────────────────────────────

export async function runAgentOnce(
  agentId: string,
  userWallet: string,
  inputs: Record<string, unknown>,
  onStepEmit?: (step: StepEvent) => void,
): Promise<RunResult> {
  const agent = getAgentById(agentId)
  if (!agent) throw new Error('Agent not found')
  if (!agent.active) throw new Error('Agent is inactive')

  const validationError = validateInputs(agent, inputs)
  if (validationError) throw new Error(validationError)

  if ((agent as any).price_per_run > 0) {
    const bal = getBalance(userWallet)
    if (bal < (agent as any).price_per_run) {
      throw new Error(`Insufficient balance. Need ${(agent as any).price_per_run} micro-USDC, have ${bal}.`)
    }
  }

  const db = getDb()
  const executionId = randomUUID()
  const startTime = Date.now()

  db.prepare(`
    INSERT INTO agent_executions (id, agent_id, user_wallet, input_json, status)
    VALUES ($id, $agentId, $userWallet, $inputJson, 'running')
  `).run({ $id: executionId, $agentId: agentId, $userWallet: userWallet, $inputJson: JSON.stringify(inputs) })

  onStepEmit?.({ kind: 'api', title: 'Execution started', body: agent.name, ts: new Date().toISOString() })

  try {
    const userPrompt = buildUserPrompt(agent, inputs)
    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured')

    const { output, tokensUsed, toolCallCount } = await geminiQueue.run(async () => {
      const genAI = new GoogleGenerativeAI(geminiApiKey)
      const toolUse = hasToolUse(agent)
      // Gemini API: Google Search and Function Calling cannot be combined
      const tools = toolUse
        ? [{ functionDeclarations: getToolDeclarations(agent.tools_json) }]
        : [{ googleSearch: {} }]

      const model = genAI.getGenerativeModel({
        model: resolveModel(agent),
        generationConfig: {
          temperature: agent.temperature ?? 0.3,
          maxOutputTokens: toolUse ? 4096 : (agent.max_tokens || 1024),
        },
        systemInstruction: getSystemPrompt(agent),
        tools,
        toolConfig: toolUse ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } } : undefined,
      } as any)

      if (!toolUse) {
        // Simple single-shot
        const result = await model.generateContent(userPrompt)
        const text = result.response.text()
        const usage = result.response.usageMetadata
        return { output: text, tokensUsed: usage ? (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0) : null, toolCallCount: 0 }
      }

      // Tool-use loop
      const chat = model.startChat({})
      let response = await chat.sendMessage(userPrompt)
      let callCount = 0

      while (response.response.functionCalls()?.length) {
        if (callCount >= MAX_TOOL_CALLS) {
          response = await chat.sendMessage('Maximum tool call limit reached. Synthesize findings from the data collected so far.')
          break
        }

        const functionCalls = response.response.functionCalls()!
        const functionResponses: FunctionResponsePart[] = []

        for (const fc of functionCalls) {
          callCount++
          onStepEmit?.({ kind: 'rpc', title: 'Tool call', body: fc.name, ts: new Date().toISOString() })
          const result = await executeRpcTool(fc.name, fc.args as Record<string, unknown>)
          functionResponses.push({
            functionResponse: { name: fc.name, response: result },
          })
        }

        response = await chat.sendMessage(functionResponses)
      }

      const text = response.response.text()
      const usage = response.response.usageMetadata
      return { output: text, tokensUsed: usage ? (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0) : null, toolCallCount: callCount }
    })

    const durationMs = Date.now() - startTime

    db.prepare(`
      UPDATE agent_executions SET
        output_text = $output, status = 'completed',
        duration_ms = $durationMs, tokens_used = $tokensUsed,
        amount_charged = $amountCharged, completed_at = datetime('now')
      WHERE id = $id
    `).run({ $id: executionId, $output: output, $durationMs: durationMs, $tokensUsed: tokensUsed, $amountCharged: (agent as any).price_per_run })

    incrementRunCount(agentId)
    onStepEmit?.({ kind: 'finding', title: 'Complete', body: output.slice(0, 200), ts: new Date().toISOString() })

    return { executionId, output, durationMs, tokensUsed, toolCallCount, status: 'completed' }
  } catch (e) {
    const durationMs = Date.now() - startTime
    const errorMessage = (e as Error).message
    db.prepare(`
      UPDATE agent_executions SET status = 'failed', error_message = $error, duration_ms = $durationMs, completed_at = datetime('now')
      WHERE id = $id
    `).run({ $id: executionId, $error: errorMessage, $durationMs: durationMs })
    return { executionId, output: '', durationMs, tokensUsed: null, toolCallCount: 0, status: 'failed', error: errorMessage }
  }
}

// ─── Stream mode ─────────────────────────────────────────────

export function runAgentStream(
  agentId: string,
  userWallet: string,
  inputs: Record<string, unknown>,
  onStepEmit?: (step: StepEvent) => void,
): { executionId: string; stream: ReadableStream } {
  const agent = getAgentById(agentId)
  if (!agent) throw new Error('Agent not found')
  if (!agent.active) throw new Error('Agent is inactive')

  const validationError = validateInputs(agent, inputs)
  if (validationError) throw new Error(validationError)

  if ((agent as any).price_per_run > 0) {
    const bal = getBalance(userWallet)
    if (bal < (agent as any).price_per_run) {
      throw new Error(`Insufficient balance. Need ${(agent as any).price_per_run} micro-USDC, have ${bal}.`)
    }
  }

  const db = getDb()
  const executionId = randomUUID()
  const startTime = Date.now()

  db.prepare(`
    INSERT INTO agent_executions (id, agent_id, user_wallet, input_json, status)
    VALUES ($id, $agentId, $userWallet, $inputJson, 'running')
  `).run({ $id: executionId, $agentId: agentId, $userWallet: userWallet, $inputJson: JSON.stringify(inputs) })

  onStepEmit?.({ kind: 'api', title: 'Execution started', body: agent.name, ts: new Date().toISOString() })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) }
        catch { /* client disconnected */ }
      }

      try {
        const userPrompt = buildUserPrompt(agent, inputs)
        const geminiApiKey = process.env.GEMINI_API_KEY
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured')

        let fullOutput = ''
        let tokensUsed: number | null = null
        let toolCallCount = 0

        await geminiQueue.run(async () => {
          const genAI = new GoogleGenerativeAI(geminiApiKey)
          const toolUse = hasToolUse(agent)
          // Gemini API: Google Search and Function Calling cannot be combined
          const tools = toolUse
            ? [{ functionDeclarations: getToolDeclarations(agent.tools_json) }]
            : [{ googleSearch: {} }]

          const model = genAI.getGenerativeModel({
            model: resolveModel(agent),
            generationConfig: {
              temperature: agent.temperature ?? 0.3,
              maxOutputTokens: toolUse ? 4096 : (agent.max_tokens || 1024),
            },
            systemInstruction: getSystemPrompt(agent),
            tools,
            toolConfig: toolUse ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } } : undefined,
          } as any)

          if (!toolUse) {
            // Simple streaming without tools
            const result = await model.generateContentStream(userPrompt)
            for await (const chunk of result.stream) {
              const text = chunk.text()
              if (text) { fullOutput += text; send('chunk', { text }) }
            }
            const response = await result.response
            const usage = response.usageMetadata
            tokensUsed = usage ? (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0) : null
            return
          }

          // Tool-use streaming loop
          const chat = model.startChat({})
          let streamResult = await chat.sendMessageStream(userPrompt)

          while (true) {
            // Stream text chunks
            for await (const chunk of streamResult.stream) {
              const text = chunk.text()
              if (text) { fullOutput += text; send('chunk', { text }) }
            }

            const aggregated = await streamResult.response
            const calls = aggregated.functionCalls()
            if (!calls?.length || toolCallCount >= MAX_TOOL_CALLS) break

            // Execute tools
            send('tool_use', { calls: calls.map(c => ({ name: c.name, args: c.args })) })

            const functionResponses: FunctionResponsePart[] = []
            for (const fc of calls) {
              toolCallCount++
              onStepEmit?.({ kind: 'rpc', title: 'Tool call', body: fc.name, ts: new Date().toISOString() })
              const result = await executeRpcTool(fc.name, fc.args as Record<string, unknown>)
              functionResponses.push({
                functionResponse: { name: fc.name, response: result },
              })
            }

            send('tool_result', {
              results: functionResponses.map(r => ({
                name: r.functionResponse.name,
                hasError: !!(r.functionResponse.response as any)?.error,
              })),
              totalCalls: toolCallCount,
            })

            // Continue conversation with tool results
            streamResult = await chat.sendMessageStream(functionResponses)
          }

          const usage = (await streamResult.response).usageMetadata
          tokensUsed = usage ? (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0) : null
        })

        const durationMs = Date.now() - startTime

        db.prepare(`
          UPDATE agent_executions SET
            output_text = $output, status = 'completed',
            duration_ms = $durationMs, tokens_used = $tokensUsed,
            amount_charged = $amountCharged, completed_at = datetime('now')
          WHERE id = $id
        `).run({ $id: executionId, $output: fullOutput, $durationMs: durationMs, $tokensUsed: tokensUsed, $amountCharged: (agent as any).price_per_run })

        incrementRunCount(agentId)
        onStepEmit?.({ kind: 'finding', title: 'Complete', body: fullOutput.slice(0, 200), ts: new Date().toISOString() })

        send('complete', { executionId, durationMs, tokensUsed, toolCallCount, status: 'completed' })
        controller.close()
      } catch (e) {
        const durationMs = Date.now() - startTime
        const errorMessage = (e as Error).message
        db.prepare(`
          UPDATE agent_executions SET status = 'failed', error_message = $error, duration_ms = $durationMs, completed_at = datetime('now')
          WHERE id = $id
        `).run({ $id: executionId, $error: errorMessage, $durationMs: durationMs })
        send('error', { error: errorMessage })
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return { executionId, stream }
}

// ─── Chat mode ──────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

interface ChatResult {
  reply: string
  tokensUsed: number | null
  toolCallCount: number
}

export async function chatWithAgent(
  agentId: string,
  userWallet: string,
  message: string,
  history: ChatMessage[],
  inputs: Record<string, unknown> = {},
  onStepEmit?: (step: StepEvent) => void,
): Promise<ChatResult> {
  const agent = getAgentById(agentId)
  if (!agent) throw new Error('Agent not found')
  if (!agent.active) throw new Error('Agent is inactive')

  const geminiApiKey = process.env.GEMINI_API_KEY
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured')

  onStepEmit?.({ kind: 'api', title: 'Execution started', body: agent.name, ts: new Date().toISOString() })

  return geminiQueue.run(async () => {
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const toolUse = hasToolUse(agent)
    // Gemini API: Google Search and Function Calling cannot be combined
    const tools = toolUse
      ? [{ functionDeclarations: getToolDeclarations(agent.tools_json) }]
      : [{ googleSearch: {} }]

    const model = genAI.getGenerativeModel({
      model: resolveModel(agent),
      generationConfig: {
        temperature: agent.temperature ?? 0.3,
        maxOutputTokens: toolUse ? 4096 : (agent.max_tokens || 1024),
      },
      systemInstruction: getSystemPrompt(agent),
      tools,
      toolConfig: toolUse ? { functionCallingConfig: { mode: FunctionCallingMode.AUTO } } : undefined,
    } as any)

    // Build initial context from inputs if this is the first message (no history)
    const isFirstMessage = history.length === 0
    let effectiveMessage = message
    if (isFirstMessage && Object.keys(inputs).length > 0 && agent.user_prompt_template) {
      effectiveMessage = buildUserPrompt(agent, { ...inputs, query: message, _query: message })
    }

    const chat = model.startChat({ history })
    let response = await chat.sendMessage(effectiveMessage)
    let toolCallCount = 0

    // Tool-use loop
    while (toolUse && response.response.functionCalls()?.length) {
      if (toolCallCount >= MAX_TOOL_CALLS) {
        response = await chat.sendMessage('Maximum tool call limit reached. Synthesize findings from the data collected so far.')
        break
      }

      const functionCalls = response.response.functionCalls()!
      const functionResponses: FunctionResponsePart[] = []

      for (const fc of functionCalls) {
        toolCallCount++
        onStepEmit?.({ kind: 'rpc', title: 'Tool call', body: fc.name, ts: new Date().toISOString() })
        const result = await executeRpcTool(fc.name, fc.args as Record<string, unknown>)
        functionResponses.push({
          functionResponse: { name: fc.name, response: result },
        })
      }

      response = await chat.sendMessage(functionResponses)
    }

    const text = response.response.text()
    const usage = response.response.usageMetadata
    const tokensUsed = usage ? (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0) : null

    onStepEmit?.({ kind: 'finding', title: 'Complete', body: text.slice(0, 200), ts: new Date().toISOString() })

    return { reply: text, tokensUsed, toolCallCount }
  })
}

// ─── Query helpers ───────────────────────────────────────────

export function getExecutionsByAgent(
  agentId: string,
  opts: { requestingWallet?: string; isCreator?: boolean; limit?: number } = {},
): AgentExecutionRow[] {
  const db = getDb()
  const limit = opts.limit ?? 20

  if (opts.isCreator) {
    return db.prepare('SELECT * FROM agent_executions WHERE agent_id = $agentId ORDER BY created_at DESC LIMIT $limit')
      .all({ $agentId: agentId, $limit: limit }) as AgentExecutionRow[]
  }
  if (opts.requestingWallet) {
    return db.prepare('SELECT * FROM agent_executions WHERE agent_id = $agentId AND user_wallet = $wallet ORDER BY created_at DESC LIMIT $limit')
      .all({ $agentId: agentId, $wallet: opts.requestingWallet, $limit: limit }) as AgentExecutionRow[]
  }
  return db.prepare(`SELECT id, agent_id, user_wallet, status, duration_ms, tokens_used, amount_charged, created_at, completed_at,
    NULL as input_json, NULL as output_text, NULL as output_metadata_json, NULL as error_message
    FROM agent_executions WHERE agent_id = $agentId ORDER BY created_at DESC LIMIT $limit`)
    .all({ $agentId: agentId, $limit: limit }) as AgentExecutionRow[]
}

export function getExecutionById(id: string): AgentExecutionRow | undefined {
  return (getDb().prepare('SELECT * FROM agent_executions WHERE id = $id').get({ $id: id }) as AgentExecutionRow) ?? undefined
}
