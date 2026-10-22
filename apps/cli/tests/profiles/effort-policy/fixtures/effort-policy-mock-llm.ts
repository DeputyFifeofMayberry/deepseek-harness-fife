/**
 * Keyless model script for the effort-policy profile fixture: run the configured
 * check, fix what it reports with the real `write` tool, then run the same check
 * again under a different description.
 * @module effort-policy-mock-llm
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

/** Shell tool the shipped base bundle mounts on this platform. */
const SHELL_TOOL = process.platform === 'win32' ? 'pwsh' : 'bash'
/** The command the fork overlay declares as its verifier. */
const CHECK_COMMAND = 'pnpm run typecheck'
/** Text the seeded stand-in check prints when it fails. */
export const CHECK_FAILURE_TEXT = 'error TS9999: seeded typecheck failure'
/** Text the seeded stand-in check prints when it passes. */
export const CHECK_PASS_TEXT = 'run-gates: 5 passed, 0 failed, 0 skipped in 0.01s.'

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

/** Keyless adapter that drives one verification, one mutation, and one re-check. */
class EffortPolicyMockAdapter extends LlmAdapter {
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
    const results = options.messages.filter(
      (message): message is ToolResultMessage => message.role === 'tool',
    )
    const last = results.at(-1)
    if (last === undefined) {
      // The first request carries no tool result yet: run the check.
      yield* toolCall('effort-check-1', SHELL_TOOL, {
        command: CHECK_COMMAND,
        description: 'Run the typecheck',
      })
      return
    }
    const text = textOf(last)
    if (text.includes(CHECK_PASS_TEXT)) {
      yield* textReply('CHECK_CLEARED')
      return
    }
    if (text.includes(CHECK_FAILURE_TEXT)) {
      // Repair the workspace with a real mutating tool, not another check.
      yield* toolCall('effort-fix', 'write', { file_path: 'FIXED', content: 'fixed\n' })
      return
    }
    if (results.length === 2) {
      // The write resolved: re-run the same check, retitled.
      yield* toolCall('effort-check-2', SHELL_TOOL, {
        command: CHECK_COMMAND,
        description: 'Confirm the typecheck now passes',
      })
      return
    }
    yield* textReply('CHECK_DID_NOT_RUN')
  }
}

export const name = 'effort-policy-mock-llm'
export const inject = ['llm']

/**
 * Register the keyless `effort-mock` adapter the fixture's default model names.
 * @param ctx - the plugin context whose `llm` runtime receives the adapter.
 */
export function apply(ctx: Context): void {
  ctx.llm.registerAdapter(['effort-mock'], new EffortPolicyMockAdapter())
}
