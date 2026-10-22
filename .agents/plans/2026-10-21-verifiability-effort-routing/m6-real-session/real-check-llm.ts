/**
 * Ad-hoc M6 evidence: a keyless script that runs the repository's real
 * `pnpm run typecheck`, removes one planted probe file, then runs the same real
 * command again under a different description.
 * @module real-check-llm
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  LlmAdapter,
  ReasoningEffortId,
  ToolCallId,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type StreamChunk,
  type ToolResultMessage,
} from '@deepseek-ai/dsh-llm'
import { fileURLToPath } from 'node:url'

const PROBE = 'packages/llm/effort-policy/src/__m6-real-session-probe.ts'
const REMOVE = process.platform === 'win32'
  ? `Remove-Item -Force '${PROBE}'`
  : `rm -f '${PROBE}'`
const FAILED = 'error TS'
const PASSED = 'passed, 0 failed'

function textOf(message: ToolResultMessage): string {
  return message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')
}

function toolCall(callId: string, name: string, args: unknown): StreamChunk[] {
  const serialized = JSON.stringify(args)
  return [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 0, id: ToolCallId(callId), name, argumentsDelta: serialized },
    { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(callId), name, arguments: serialized } },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ]
}

function textReply(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

const SHELL = process.platform === 'win32' ? 'pwsh' : 'bash'

class RealCheckAdapter extends LlmAdapter {
  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return {
      provider,
      id: model,
      name: model,
      reasoning: {
        efforts: [
          { id: ReasoningEffortId('off'), name: 'Off' },
          { id: ReasoningEffortId('low'), name: 'Low' },
          { id: ReasoningEffortId('high'), name: 'High' },
          { id: ReasoningEffortId('max'), name: 'Max' },
        ],
        defaultEffort: ReasoningEffortId('high'),
      },
    }
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const results = options.messages.filter((m): m is ToolResultMessage => m.role === 'tool')
    const last = results.at(-1)
    if (last === undefined) {
      yield* toolCall('real-check-1', SHELL, { command: 'pnpm run typecheck', description: 'Run the typecheck' })
      return
    }
    const text = textOf(last)
    if (text.includes(PASSED)) {
      yield* textReply('REAL_CHECK_CLEARED')
      return
    }
    if (text.includes(FAILED)) {
      yield* toolCall('real-fix', SHELL, { command: REMOVE, description: 'Remove the seeded probe' })
      return
    }
    if (results.length === 2) {
      yield* toolCall('real-check-2', SHELL, { command: 'pnpm run typecheck', description: 'Confirm the typecheck passes' })
      return
    }
    yield* textReply(`REAL_CHECK_DID_NOT_RUN: ${text.slice(0, 400)}`)
  }
}

export const name = 'real-check-llm'
export const inject = ['llm']

/**
 * Register the `real-check` adapter the ad-hoc composition names.
 * @param ctx - the plugin context whose `llm` runtime receives the adapter.
 */
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['real-check'], new RealCheckAdapter())
}
