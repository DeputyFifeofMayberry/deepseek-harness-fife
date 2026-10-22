/**
 * Sidebar footer chip stating whether DeepSeek API billing is currently in
 * peak or off-peak hours. Purely informational: the schedule is computed from
 * the published UTC windows, no Host service, storage, or network is involved,
 * and the chip re-renders only when the phase actually flips.
 *
 * @module @deepseek-ai/dsh-client-ui-price-phase/PricePhaseChip
 */
import type { ReactNode } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, PropsHooks, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PricePhaseReading } from './price-phase.ts'
import css from './PricePhaseChip.module.css'

/** Locale seat of this plugin's namespace. */
type ChipTranslate = PropsLocale<'pricePhase'>['t']

/** Localized instant text for a boundary: short weekday plus 12-hour clock. */
function boundaryText(at: number, t: ChipTranslate): string {
  return new Intl.DateTimeFormat(t('time.locale'), {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(at)
}

/** Component props: the sidebar's column state plus this namespace's locale seat. */
export type PricePhaseChipProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsLocale<'pricePhase'>
  & PropsHooks<{ phase: HostObservable<PricePhaseReading> }>

/**
 * Render the chip: a quiet dot with the phase word when the sidebar is wide,
 * the dot alone on the collapsed rail — the tooltip carries the detail either way.
 * @param props - sidebar column state, the shared phase reading, and the locale seat.
 * @returns the chip.
 */
export function PricePhaseChip({ wide, usePhase, t }: PricePhaseChipProps): ReactNode {
  const reading = usePhase(reading => reading)
  const peak = reading.phase === 'peak'
  const phase = t(peak ? 'phase.peak' : 'phase.offPeak')
  const tooltip = t(peak ? 'tooltip.peak' : 'tooltip.offPeak', {
    time: boundaryText(reading.nextBoundary, t),
  }) + ' ' + t('tooltip.windows')
  return (
    <Tooltip label={tooltip} side="right" maxWidth={320}>
      <span
        className={peak ? `${css.chip} ${css.peak}` : css.chip}
        role="note"
        aria-label={t(peak ? 'chip.aria.peak' : 'chip.aria.offPeak')}
        data-price-phase={reading.phase}
      >
        <span className={css.dot} aria-hidden />
        {wide && <span className={css.label}>{phase}</span>}
      </span>
    </Tooltip>
  )
}
