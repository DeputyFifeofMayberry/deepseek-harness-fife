/**
 * Loader fixture that creates the one root Agent this scenario drives. The
 * shipped headless startup row performs this in the product path; it is
 * disabled here so the driver owns the task text.
 * @module step-prune-agent
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'

/** Fixture plugin name. */
export const name = 'step-prune-agent'
/** Services that must exist before the fixture creates its Agent; the loop owns the factory. */
export const inject = ['agents', 'agentLoop', 'agentDefaultModel']

/**
 * Create one root Agent on the configured default selection.
 * @param ctx - settled Agent registry and default-model services.
 * @returns after the Agent is published.
 */
export async function apply(ctx: Context): Promise<void> {
  const handle = await ctx.agents.create({
    sessionId: SessionId('step-prune-fixture'),
    agentOptions: ctx.agentDefaultModel.currentSelection(),
  })
  ctx.effect(() => () => handle.dispose(), 'step-prune-agent.handle')
}
