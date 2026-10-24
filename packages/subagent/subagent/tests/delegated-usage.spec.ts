/** Parent-side attribution of a child epoch's provider usage. */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId, SessionSeq } from '@deepseek-ai/dsh-session'
import type { EpochHeader, SessionEvent } from '@deepseek-ai/dsh-session'
import { appendDelegatedUsage, delegatedUsageRoutes } from '../src/delegated-usage.ts'

const CHILD = SessionId('delegated-child')

function header(model: string, effort?: 'low' | 'high'): EpochHeader {
  return {
    config: {
      provider: 'deepseek-official',
      model,
      ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
    },
  }
}

function event<T extends SessionEvent['type']>(
  type: T,
  data: Extract<SessionEvent, { type: T }>['data'],
  time = 0,
): SessionEvent {
  return { type, seq: SessionSeq(0), time, data } as SessionEvent
}

function promoted(model = 'deepseek-flash', effort?: 'low' | 'high'): SessionEvent {
  return event('request/header', { header: header(model, effort), reason: 'initial' })
}

function settled(
  turn: number,
  step: number,
  usage: TokenUsage | undefined,
): SessionEvent {
  return event('assistant/message', {
    turn,
    step,
    ...usage === undefined ? {} : { usage },
    message: createMessage({
      role: 'assistant',
      content: [],
      source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' },
    }),
    stream: usage === undefined
      ? []
      : [{ type: 'chunk', time: 0, chunk: { type: 'usage', usage } }],
  })
}

describe('delegatedUsageRoutes', () => {
  it('reports nothing for an epoch that never called a model', () => {
    expect(delegatedUsageRoutes([])).toEqual([])
    expect(delegatedUsageRoutes([event('step/start', { turn: 1, step: 0 })])).toEqual([])
  })

  it('attributes settlements to the route their header named, in first-seen order', () => {
    expect(delegatedUsageRoutes([
      promoted('deepseek-flash'),
      settled(1, 0, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 5 }),
      promoted('deepseek-v4-pro', 'high'),
      settled(1, 1, { inputTokens: 7, outputTokens: 3 }),
    ])).toEqual([
      {
        provider: 'deepseek-official',
        model: 'deepseek-flash',
        reasoningEffort: '',
        uncachedInputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 5,
        cacheWriteTokens: 0,
      },
      {
        provider: 'deepseek-official',
        model: 'deepseek-v4-pro',
        reasoningEffort: 'high',
        uncachedInputTokens: 7,
        outputTokens: 3,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ])
  })

  it('ignores a settlement before any header named its route', () => {
    expect(delegatedUsageRoutes([settled(1, 0, { inputTokens: 100, outputTokens: 20 })])).toEqual([])
  })

  it('ignores a settled message that carries no usage sample', () => {
    expect(delegatedUsageRoutes([promoted(), settled(1, 0, undefined)])).toEqual([])
  })

  it('counts a step once when a later settlement replaces it', () => {
    expect(delegatedUsageRoutes([
      promoted(),
      settled(1, 0, { inputTokens: 100, outputTokens: 20 }),
      settled(1, 0, { inputTokens: 100, outputTokens: 25 }),
    ])[0]?.outputTokens).toBe(25)
  })

  it('carries a nested attribution through so the root sees the whole tree', () => {
    expect(delegatedUsageRoutes([
      promoted(),
      settled(1, 0, { inputTokens: 10, outputTokens: 2 }),
      event('subagent/usage', {
        version: 0,
        childId: SessionId('grandchild'),
        routes: [{
          provider: 'deepseek-official',
          model: 'deepseek-v4-pro',
          reasoningEffort: '',
          uncachedInputTokens: 30,
          outputTokens: 6,
          cacheReadTokens: 1,
          cacheWriteTokens: 2,
        }],
      }),
    ])).toEqual([
      {
        provider: 'deepseek-official',
        model: 'deepseek-flash',
        reasoningEffort: '',
        uncachedInputTokens: 10,
        outputTokens: 2,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      {
        provider: 'deepseek-official',
        model: 'deepseek-v4-pro',
        reasoningEffort: '',
        uncachedInputTokens: 30,
        outputTokens: 6,
        cacheReadTokens: 1,
        cacheWriteTokens: 2,
      },
    ])
  })

  it('drops a route whose buckets net to zero', () => {
    expect(delegatedUsageRoutes([
      promoted(),
      settled(1, 0, { inputTokens: 0, outputTokens: 0 }),
    ])).toEqual([])
  })
})

describe('appendDelegatedUsage', () => {
  it('records the epoch on the delegating parent', async () => {
    const ctx = new Context()
    try {
      await ctx.plugin(SessionStore)
      const parent = ctx.sessions.create(SessionId('delegating-parent'))
      const appended = appendDelegatedUsage(parent, CHILD, [
        promoted(),
        settled(1, 0, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 5 }),
      ])
      expect(appended?.type).toBe('subagent/usage')
      const [record] = parent.snapshotEvents()
      expect(record).toMatchObject({ type: 'subagent/usage', seq: SessionSeq(0) })
      expect(record?.data).toEqual({
        version: 0,
        childId: CHILD,
        routes: [{
          provider: 'deepseek-official',
          model: 'deepseek-flash',
          reasoningEffort: '',
          uncachedInputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 5,
          cacheWriteTokens: 0,
        }],
      })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('appends nothing when the epoch reported no usage', async () => {
    const ctx = new Context()
    try {
      await ctx.plugin(SessionStore)
      const parent = ctx.sessions.create(SessionId('quiet-parent'))
      expect(appendDelegatedUsage(parent, CHILD, [])).toBeUndefined()
      expect(parent.snapshotEvents()).toEqual([])
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
