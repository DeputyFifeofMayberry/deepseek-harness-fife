/**
 * Ad-hoc M6 evidence: the one root Agent for the real-check session, running in
 * the repository itself so `pnpm run typecheck` is the real configured command.
 * @module real-check-agent
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { fileURLToPath } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))

export const name = 'real-check-agent'
export const inject = ['agents', 'agentLoop', 'agentDefaultModel']

/**
 * Create the root Agent in the repository working tree.
 * @param ctx - settled registry, loop, and default-model services.
 * @returns after the Agent is published.
 */
export async function apply(ctx: Context): Promise<void> {
  const handle = await ctx.agents.create({
    sessionId: SessionId('m6-real-session'),
    agentOptions: ctx.agentDefaultModel.currentSelection(),
    meta: { cwd: repositoryRoot },
  })
  ctx.effect(() => () => handle.dispose(), 'real-check-agent.handle')
}
