/** Browser attention reporter: forwards finished tasks and pending approvals to the Desktop shell. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TypertClientEventListener } from '@deepseek-ai/dsh-typert-protocol'

/**
 * Optional Desktop bridge face this plugin reports through. Structural on purpose:
 * plain browsers leave `dshDesktop` absent, and client packages never import the
 * shell's own types.
 */
interface DesktopActivityBridge {
  readonly activity?: {
    readonly report?: (event: {
      readonly kind: 'task-complete' | 'approval-request' | 'approval-resolved'
      readonly sessionId: string
    }) => void
  }
}

/** Required services: the session catalog and the Remote Event waterfall. */
export const inject = ['sessions', 'remote']

/** Listener signature of the scoped approval waterfall; re-exported for tests. */
type ApprovalListener = TypertClientEventListener<'approval/request'>

/**
 * Install the Desktop attention reporters. Completion follows the session
 * catalog's `running` transitions for Host-listed sessions (first observation is
 * the baseline, so boot and reconnection never notify); approvals wrap the
 * existing scoped waterfall consumer. Without the Desktop bridge the plugin is
 * inert.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const report = (globalThis as { dshDesktop?: DesktopActivityBridge }).dshDesktop?.activity?.report
  if (report === undefined) return
  ctx.effect(() => {
    // Session id to its last observed running state; only Host-listed sessions
    // (`state.ids`) are tracked, so subagent fallback rows in `byId` never notify.
    const observed = new Map<SessionId, boolean>()
    return ctx.sessions.list.subscribe(() => {
      const state = ctx.sessions.list.getSnapshot()
      const listed = new Set(state.ids)
      for (const id of state.ids) {
        const summary = state.byId[id]
        if (summary === undefined) continue
        const wasRunning = observed.get(id)
        observed.set(id, summary.running)
        // First sight is the baseline: boot, reconnection, and list replacement
        // establish state instead of reporting a completion.
        if (wasRunning === undefined) continue
        if (wasRunning && !summary.running) report({ kind: 'task-complete', sessionId: id })
      }
      for (const id of observed.keys()) {
        if (!listed.has(id)) observed.delete(id)
      }
    })
  }, 'ui-attention: completion observations')
  ctx.remote.$on('approval/request', function (_request, next) {
    const sessionId = ctx.sessions.scopeOf(this)
    if (sessionId === undefined) return next()
    report({ kind: 'approval-request', sessionId })
    const outcome = next()
    // This wrapper must be composed before the approval consumer so `next()`
    // settles with the real answer; resolving afterwards reports the decision.
    void Promise.resolve(outcome).finally(() => { report({ kind: 'approval-resolved', sessionId }) })
    return outcome
  })
}

export type { ApprovalListener }
