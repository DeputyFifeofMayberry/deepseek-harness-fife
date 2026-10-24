/**
 * Keyless model script for the step-prune profile fixture: run the emit command
 * once, then report whether the result the second request received arrived
 * pruned. The emitted payload's head and tail survive budgeting; its long
 * middle must not.
 * @module step-prune-mock-llm
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  LlmAdapter,
  ToolCallId,
  type GenerateOptions,
  type LlmResolvedModelInfo,
  type StreamChunk,
  type ToolResultMessage,
} from '@deepseek-ai/dsh-llm'

/** Shell tool the shipped base bundle mounts on this platform. */
const SHELL_TOOL = process.platform === 'win32' ? 'pwsh' : 'bash'
/** The command the fixture's prepared `emit.mjs` answers. */
const EMIT_COMMAND = 'node emit.mjs'
/** Sentinel at the end of the emitted payload; budgeting always retains it. */
export const EMIT_TAIL_TOKEN = 'TAIL_TOKEN'
/** Length of the long middle that budgeting must remove. */
export const EMIT_FILLER = 'A'.repeat(400)
/** A middle this long cannot survive a 200-char threshold with a 50-char head. */
const FILLER_OVER_BUDGET = 'A'.repeat(60)

function textOf(message: ToolResultMessage): string {
  return message.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('')
}

function toolCall(callId: string, name: string, args: unknown, index = 0): StreamChunk[] {
  const serialized = JSON.stringify(args)
  return [
    { type: 'block-start', index, blockType: 'tool-call' },
    { type: 'tool-call-delta', index, id: ToolCallId(callId), name, argumentsDelta: serialized },
    { type: 'block-end', index, block: { type: 'tool-call', id: ToolCallId(callId), name, arguments: serialized } },
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

/** Keyless adapter that drives one emit and reports whether pruning preceded the second request. */
class StepPruneMockAdapter extends LlmAdapter {
  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return {
      provider,
      id: model,
      name: model,
      context: { contextWindow: 100_000 },
      defaultMaxTokens: 1_000,
    }
  }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const results = options.messages.filter(
      (message): message is ToolResultMessage => message.role === 'tool',
    )
    const last = results.at(-1)
    if (last === undefined) {
      // The first request carries no tool result yet: emit the payload.
      yield* toolCall('prune-emit-1', SHELL_TOOL, {
        command: EMIT_COMMAND,
        description: 'Emit the sample output',
      })
      return
    }
    const text = textOf(last)
    if (text.includes(EMIT_TAIL_TOKEN) && !text.includes(FILLER_OVER_BUDGET)) {
      yield* textReply('PRUNE_SEEN')
      return
    }
    if (text.includes(EMIT_TAIL_TOKEN)) {
      yield* textReply('PRUNE_MISSED')
      return
    }
    yield* textReply('EMIT_DID_NOT_RUN')
  }
}

export const name = 'prune-mock-llm'
export const inject = ['llm']

/**
 * Register the keyless `prune-mock` adapter the fixture's default model names.
 * @param ctx - the plugin context whose `llm` runtime receives the adapter.
 */
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['prune-mock'], new StepPruneMockAdapter())
}
