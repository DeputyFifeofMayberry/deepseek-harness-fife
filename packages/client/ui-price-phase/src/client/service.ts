/** Shared client service for the DeepSeek billing-phase reading. */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import { createPricePhaseSource, type PricePhaseSource } from './phase-source.ts'
import { pricePhase } from './price-phase.ts'
import type { PricePhaseReading } from './price-phase.ts'

/** Owns the one boundary-advancing phase reading shared by client surfaces. */
export class PricePhaseService extends Service {
  /** Current phase reading, updated at each schedule boundary. */
  readonly reading: HostObservable<PricePhaseReading>
  /** Pure phase calculation for one instant. */
  readonly at: (at: number) => PricePhaseReading = pricePhase
  private readonly source: PricePhaseSource

  /**
   * @param ctx - client plugin context.
   */
  constructor(ctx: Context) {
    super(ctx, 'pricePhase')
    this.source = createPricePhaseSource()
    this.reading = this.source
    ctx.effect(() => () => { this.source.dispose() }, 'ui-price-phase: phase reading lifetime')
  }
}
