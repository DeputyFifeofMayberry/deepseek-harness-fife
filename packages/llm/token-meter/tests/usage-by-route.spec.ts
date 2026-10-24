/** Route and UTC-hour buckets for provider usage. */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionSeq, SessionId } from '@deepseek-ai/dsh-session'
import type { EpochHeader, Session, SessionEvent, SessionEventMap, SessionEventType } from '@deepseek-ai/dsh-session'
import type { DelegatedUsageRoute } from '@deepseek-ai/dsh-subagent'
import { RetryId } from '@deepseek-ai/dsh-llm-retry'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import TokenMeter from '@deepseek-ai/dsh-token-meter'
import type { UsageByRouteProjection } from '@deepseek-ai/dsh-token-meter/client'
import { usageByRouteProjectionDefinition as definition } from '../src/usage-by-route.ts'

const MONDAY = Date.UTC(2024, 0, 1)
const HOUR = 3_600_000
const TUESDAY_ONE = MONDAY + 25 * HOUR
const SUNDAY_LATE = MONDAY + 167 * HOUR

function header(model = 'deepseek-flash', effort?: 'low' | 'high'): EpochHeader {
  return {
    config: {
      provider: 'deepseek-official',
      model,
      ...effort === undefined ? {} : { reasoningEffort: ReasoningEffortId(effort) },
    },
  }
}

function usage(inputTokens: number, outputTokens: number, cacheReadTokens = 0): TokenUsage {
  return { inputTokens, outputTokens, cacheReadTokens }
}

function event<T extends SessionEventType>(
  type: T,
  time: number,
  data: SessionEventMap[T],
): SessionEvent<T> {
  return { type, seq: SessionSeq(0), time, data } as SessionEvent<T>
}

type State = Parameters<typeof definition.apply>[0]

function appendHeader(state: State, time: number, value: EpochHeader): State {
  return definition.apply(state, event('request/header', time, { header: value, reason: 'initial' }))
}

function appendAttempt(state: State, time: number, turn: number, step: number, sample: TokenUsage): State {
  return definition.apply(state, event('assistant/attempt', time, {
    turn,
    step,
    stream: [{ type: 'chunk', time: 0, chunk: { type: 'usage', usage: sample } }],
  }))
}

function appendMessage(state: State, time: number, turn: number, step: number, sample: TokenUsage): State {
  return definition.apply(state, event('assistant/message', time, {
    turn,
    step,
    usage: sample,
    message: createMessage({
      role: 'assistant',
      content: [],
      source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' },
    }),
    stream: [{ type: 'chunk', time: 0, chunk: { type: 'usage', usage: sample } }],
  }))
}

function retry(state: State, time: number, turn: number, step: number): State {
  return definition.apply(state, event('llm/retry-started', time, {
    turn,
    step,
    retryId: RetryId('usage-by-route-retry'),
    retry: 1,
  }))
}

function delegated(state: State, time: number, routes: readonly DelegatedUsageRoute[]): State {
  return definition.apply(state, event('subagent/usage', time, {
    version: 0,
    childId: SessionId('delegated-child'),
    routes,
  }))
}

function view(state: State): UsageByRouteProjection {
  return definition.wire.view(state)
}

describe('usageByRoute projection', () => {
  it('serves no routes before usage and ignores usage without a header', () => {
    const initial = definition.init()
    expect(view(initial)).toEqual({ routes: [] })
    const unheaded = appendMessage(initial, MONDAY, 1, 0, usage(10, 1))
    expect(view(unheaded)).toEqual({ routes: [] })
  })

  it('buckets usage by route and UTC hour of week', () => {
    let state = appendHeader(definition.init(), MONDAY, header())
    state = appendMessage(state, MONDAY, 1, 0, usage(100, 20, 5))
    state = appendAttempt(state, TUESDAY_ONE, 1, 1, usage(7, 3))
    expect(view(state)).toEqual({
      routes: [{
        provider: 'deepseek-official',
        model: 'deepseek-flash',
        reasoningEffort: '',
        buckets: [
          {
            hourOfWeek: 0,
            usage: { uncachedInputTokens: 100, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 0 },
          },
          {
            hourOfWeek: 25,
            usage: { uncachedInputTokens: 7, outputTokens: 3, cacheReadTokens: 0, cacheWriteTokens: 0 },
          },
        ],
      }],
    })
  })

  it('replaces an earlier sample for the same step instead of adding it', () => {
    let state = appendHeader(definition.init(), MONDAY, header())
    state = appendAttempt(state, MONDAY, 1, 0, usage(100, 20))
    state = appendMessage(state, MONDAY, 1, 0, usage(100, 25))
    expect(view(state).routes[0]?.buckets).toEqual([{
      hourOfWeek: 0,
      usage: { uncachedInputTokens: 100, outputTokens: 25, cacheReadTokens: 0, cacheWriteTokens: 0 },
    }])
  })

  it('counts a retried attempt as a separate settlement', () => {
    let state = appendHeader(definition.init(), MONDAY, header())
    state = appendAttempt(state, MONDAY, 1, 0, usage(100, 20))
    state = retry(state, MONDAY, 1, 0)
    state = appendMessage(state, MONDAY, 1, 0, usage(10, 2))
    expect(view(state).routes[0]?.buckets[0]?.usage).toEqual({
      uncachedInputTokens: 110, outputTokens: 22, cacheReadTokens: 0, cacheWriteTokens: 0,
    })
  })

  it('starts a new route when the header changes and keeps effort distinct', () => {
    let state = appendHeader(definition.init(), MONDAY, header('deepseek-flash', 'low'))
    state = appendMessage(state, MONDAY, 1, 0, usage(10, 2))
    state = appendHeader(state, TUESDAY_ONE, header('deepseek-flash', 'high'))
    state = appendMessage(state, TUESDAY_ONE, 1, 1, usage(20, 4))
    state = appendHeader(state, SUNDAY_LATE, header('deepseek-v4-pro'))
    state = appendMessage(state, SUNDAY_LATE, 1, 2, usage(30, 6))
    expect(view(state).routes.map(route => [route.model, route.reasoningEffort, route.buckets[0]?.hourOfWeek]))
      .toEqual([
        ['deepseek-flash', 'high', 25],
        ['deepseek-flash', 'low', 0],
        ['deepseek-v4-pro', '', 167],
      ])
  })

  it('omits routes whose buckets net to zero', () => {
    let state = appendHeader(definition.init(), MONDAY, header())
    state = appendAttempt(state, MONDAY, 1, 0, usage(10, 2))
    state = appendMessage(state, MONDAY, 1, 0, usage(0, 0))
    expect(view(state)).toEqual({ routes: [] })
  })


  it('ignores an assistant event that carries no usage sample', () => {
    let state = appendHeader(definition.init(), MONDAY, header())
    state = definition.apply(state, event('assistant/attempt', MONDAY, { turn: 1, step: 0, stream: [] }))
    expect(view(state)).toEqual({ routes: [] })
  })

  it('leaves state unchanged when the same replacement sample repeats', () => {
    let state = appendHeader(definition.init(), MONDAY, header())
    state = appendMessage(state, MONDAY, 1, 0, usage(10, 2))
    expect(appendMessage(state, MONDAY, 1, 0, usage(10, 2))).toBe(state)
  })

  it('replaces a sample on a later route while other routes and buckets stay put', () => {
    let state = appendHeader(definition.init(), MONDAY, header('deepseek-flash', 'low'))
    state = appendMessage(state, MONDAY, 1, 0, usage(10, 2))
    state = appendMessage(state, TUESDAY_ONE, 1, 1, usage(20, 4))
    state = appendHeader(state, SUNDAY_LATE, header('deepseek-v4-pro'))
    state = appendMessage(state, SUNDAY_LATE, 1, 2, usage(30, 6))
    state = appendHeader(state, TUESDAY_ONE, header('deepseek-flash', 'low'))
    state = appendAttempt(state, TUESDAY_ONE, 2, 0, usage(5, 1))
    state = appendMessage(state, TUESDAY_ONE, 2, 0, usage(6, 2))
    expect(view(state).routes).toEqual([
      {
        provider: 'deepseek-official',
        model: 'deepseek-flash',
        reasoningEffort: 'low',
        buckets: [
          {
            hourOfWeek: 0,
            usage: { uncachedInputTokens: 10, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0 },
          },
          {
            hourOfWeek: 25,
            usage: { uncachedInputTokens: 26, outputTokens: 6, cacheReadTokens: 0, cacheWriteTokens: 0 },
          },
        ],
      },
      {
        provider: 'deepseek-official',
        model: 'deepseek-v4-pro',
        reasoningEffort: '',
        buckets: [{
          hourOfWeek: 167,
          usage: { uncachedInputTokens: 30, outputTokens: 6, cacheReadTokens: 0, cacheWriteTokens: 0 },
        }],
      },
    ])
  })


  it('keeps state when a header snapshot repeats the active route', () => {
    const state = appendHeader(definition.init(), MONDAY, header())
    expect(appendHeader(state, MONDAY, header())).toBe(state)
  })

  it('ignores a retry that does not close the last sample', () => {
    let state = appendHeader(definition.init(), MONDAY, header())
    state = appendMessage(state, MONDAY, 1, 0, usage(10, 2))
    expect(retry(state, MONDAY, 2, 0)).toBe(state)
  })

  it('ignores unrelated events', () => {
    const state = appendHeader(definition.init(), MONDAY, header())
    expect(definition.apply(state, event('step/start', MONDAY, { turn: 1, step: 0 }))).toBe(state)
  })

  it('buckets delegated usage under the child route it names', () => {
    let state = delegated(definition.init(), TUESDAY_ONE, [{
      provider: 'deepseek-official',
      model: 'deepseek-v4-pro',
      reasoningEffort: 'high',
      uncachedInputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 5,
      cacheWriteTokens: 1,
    }])
    state = delegated(state, TUESDAY_ONE, [{
      provider: 'deepseek-official',
      model: 'deepseek-v4-pro',
      reasoningEffort: 'high',
      uncachedInputTokens: 10,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    }])
    expect(view(state)).toEqual({
      routes: [{
        provider: 'deepseek-official',
        model: 'deepseek-v4-pro',
        reasoningEffort: 'high',
        buckets: [{
          hourOfWeek: 25,
          usage: { uncachedInputTokens: 110, outputTokens: 22, cacheReadTokens: 5, cacheWriteTokens: 1 },
        }],
      }],
    })
  })

  it('keeps state for an attribution that names no route', () => {
    const state = appendHeader(definition.init(), MONDAY, header())
    expect(delegated(state, MONDAY, [])).toBe(state)
  })

  it('round-trips state and wire through their schemas', () => {
    let state = appendHeader(definition.init(), MONDAY, header())
    state = appendMessage(state, MONDAY, 1, 0, usage(10, 2))
    expect(definition.stateSchema.parse(state)).toEqual(state)
    expect(definition.wire.viewSchema.parse(view(state))).toEqual(view(state))
  })
})

describe('usageByRoute registration', () => {
  it('serves the projection through a mounted token meter', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(TokenMeter)
    const session: Session = ctx.sessions.create()
    session.append('request/header', { header: header(), reason: 'initial' })
    session.append('assistant/message', {
      turn: 1,
      step: 0,
      message: createMessage({
        role: 'assistant',
        content: [],
        source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-flash' },
      }),
      usage: usage(10, 2),
      stream: [{ type: 'chunk', time: 0, chunk: { type: 'usage', usage: usage(10, 2) } }],
    }, { surfaceOp: 'append' })
    const value = ctx.sessionProjections.snapshot(session).values.usageByRoute
    expect(value?.routes[0]).toMatchObject({
      provider: 'deepseek-official',
      model: 'deepseek-flash',
      buckets: [{ usage: { uncachedInputTokens: 10, outputTokens: 2 } }],
    })
  })
})
