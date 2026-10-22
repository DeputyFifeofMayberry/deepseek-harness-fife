import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LlmRuntime, {
  createUserMessage,
  ReasoningEffortId,
  type LlmModelReasoningInfo,
} from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture } from '@deepseek-ai/dsh-tools'
import { MockAdapter, textResponse, toolCallResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'
import * as effortPolicy from '../src/index.ts'

const REASONING: LlmModelReasoningInfo = {
  efforts: [
    { id: ReasoningEffortId('off'), name: 'Off' },
    { id: ReasoningEffortId('low'), name: 'Low' },
    { id: ReasoningEffortId('high'), name: 'High' },
    { id: ReasoningEffortId('max'), name: 'Max' },
  ],
  defaultEffort: ReasoningEffortId('high'),
}

const VERIFIER_ROW = [
  '      verifiers:',
  '        - tool: verify',
  "          commandPattern: ''",
  "          passPattern: 'all good'",
  "          failPattern: 'broken'",
].join('\n')

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** Module-loader shape the Loader reads; only `import` is exercised here. */
type LoaderInternals = NonNullable<Context['loader']['internal']>

/** A load cache the test composition never consults. */
class UnusedLoadCache extends Map<string, never> {
  override get(_url: string, _type?: string): undefined {
    return undefined
  }

  override set(_url: string, _type?: string, _job?: never): this {
    return this
  }

  override has(_url: string, _type?: string): boolean {
    return false
  }
}

/**
 * Build the loader-internal object that resolves the YAML's package names from
 * this test's own module map instead of the filesystem.
 * @param importModule - resolver for one specifier.
 * @returns internals whose other members the Loader never calls in this test.
 */
function internals(importModule: (specifier: string) => Promise<unknown>): LoaderInternals {
  const unused = (): never => {
    throw new Error('loader-composition: this Loader member is not used by the test composition')
  }
  return {
    version: 'v2',
    loadCache: new UnusedLoadCache(),
    import: importModule,
    register: () => {},
    getOrCreateModuleJob: async () => unused(),
    resolveSync: unused,
    load: async () => unused(),
  }
}

/** Boot one test composition through the real Loader. */
async function loadYaml(lines: readonly string[]): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-effort-policy-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [...lines, ''].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-llm', LlmRuntime],
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-effort-policy', effortPolicy],
    ['@deepseek-ai/dsh-agent-loop', AgentLoop],
  ])
  context.loader.internal = internals(async (specifier) => {
    if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
    return modules.get(specifier)
  })
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

function stack(policyRow: readonly string[]): string[] {
  return [
    "- name: '@deepseek-ai/dsh-llm'",
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-agent'",
    ...policyRow,
    "- name: '@deepseek-ai/dsh-agent-loop'",
  ]
}

function send(agent: { followup(message: unknown): void }, text: string): void {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
}

describe('real Loader composition', () => {
  // Real-Loader composition resolves workspace packages through tsx at test
  // time; first resolution after the host/client program split is slow enough
  // to trip the default budget on cold caches.
  it('escalates and records through the shipping loop', { timeout: 60_000 }, async () => {
    const loaded = await loadYaml(stack([
      "- name: '@deepseek-ai/dsh-effort-policy'",
      '  config:',
      '      enabled: true',
      '      baseLevel: standard',
      VERIFIER_ROW,
    ]))

    const unloaded = [...loaded.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(unloaded).toEqual([])
    expect(loaded.effortPolicy.enabled).toBe(true)
    expect(loaded.effortPolicy.baseLevel).toBe('standard')

    const adapter = new MockAdapter([
      toolCallResponse('call-1', 'verify', {}),
      textResponse('first turn done'),
      textResponse('second turn done'),
    ], REASONING)
    loaded.llm.registerAdapter(['mock'], adapter)
    loaded.tools.register(defineContentToolFixture({
      name: 'verify',
      description: 'run the configured check',
      parameters: {},
      execute: async () => [{ type: 'text', text: 'broken' }],
    }))

    const agent = await loaded.agentLoop.create(SessionId('loader-effort'), { provider: 'mock', model: 'mock' })
    send(agent, 'run the check')
    await agent.whenIdle()
    // The base is the adapter default, so only the escalation is written: the
    // continuation request of the failing turn already carries it.
    expect(adapter.requests.map(request => request.reasoningEffort)).toEqual(['high', 'max'])
    expect(loaded.sessionProjections.stateOf(agent.session, 'effort')?.openFailure).toBeDefined()

    send(agent, 'next turn')
    await agent.whenIdle()
    expect(adapter.requests.at(-1)?.reasoningEffort).toBe('max')
  })

  it('loads disabled and leaves every request untouched', { timeout: 60_000 }, async () => {
    const loaded = await loadYaml(stack([
      "- name: '@deepseek-ai/dsh-effort-policy'",
      '  config:',
      '      enabled: false',
      '      baseLevel: low',
      VERIFIER_ROW,
    ]))
    expect(loaded.effortPolicy.enabled).toBe(false)

    const adapter = new MockAdapter([toolCallResponse('call-1', 'verify', {}), textResponse('done')], REASONING)
    loaded.llm.registerAdapter(['mock'], adapter)
    loaded.tools.register(defineContentToolFixture({
      name: 'verify',
      description: 'run the configured check',
      parameters: {},
      execute: async () => [{ type: 'text', text: 'broken' }],
    }))

    const agent = await loaded.agentLoop.create(SessionId('loader-effort-disabled'), { provider: 'mock', model: 'mock' })
    send(agent, 'run the check')
    await agent.whenIdle()
    expect(adapter.requests.map(request => request.reasoningEffort)).toEqual(['high', 'high'])
    expect(loaded.sessionProjections.stateOf(agent.session, 'effort')?.openFailure).toBeUndefined()
  })
})
