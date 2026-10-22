/**
 * 12-hour clock decomposition shared by every surface that prints a local
 * time of day. Decomposition is here so two surfaces naming the same instant
 * agree on the hour, the padded fields, and the meridiem; the words and their
 * placement stay in each plugin's own dictionary, per locale-owned copy.
 *
 * @module @deepseek-ai/dsh-client-ui-primitives/clock-time
 */

/** Meridiem of a 12-hour clock reading. */
export type Clock12Meridiem = 'am' | 'pm'

/** Decomposed local clock: 12-scale hour, padded minute and second, milliseconds. */
export interface Clock12Parts {
  /** Hour on the 12-scale: 1 through 12, midnight and noon both 12. */
  readonly h: number
  /** Padded two-digit minute. */
  readonly mm: string
  /** Padded two-digit whole second. */
  readonly ss: string
  /** Padded three-digit millisecond. */
  readonly mmm: string
  /** Meridiem the hour falls in; the caller renders it through its own dictionary. */
  readonly ampm: Clock12Meridiem
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Decompose an instant into 12-hour local clock parts.
 * @param at - epoch ms of the instant.
 * @returns the 12-scale hour, padded fields, and meridiem in the viewer's local zone.
 */
export function clock12Parts(at: number): Clock12Parts {
  const d = new Date(at)
  const hours = d.getHours()
  return {
    h: hours % 12 === 0 ? 12 : hours % 12,
    mm: pad2(d.getMinutes()),
    ss: pad2(d.getSeconds()),
    mmm: String(d.getMilliseconds()).padStart(3, '0'),
    ampm: hours < 12 ? 'am' : 'pm',
  }
}

/**
 * Hour on the 12-scale for a 24-scale hour, sharing the midnight/noon rule
 * with {@link clock12Parts} for surfaces that hold the hour alone (pickers).
 * @param hours - 24-scale hour, 0 through 23.
 * @returns 1 through 12; 0 and 12 both read 12.
 */
export function clock12Hour(hours: number): number {
  return hours % 12 === 0 ? 12 : hours % 12
}
