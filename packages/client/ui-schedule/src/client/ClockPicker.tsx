/**
 * Column clock picker for one staged Run time value, shown on the 12-hour
 * clock: a 01–12 hour column, minutes, optionally seconds, and an AM/PM
 * column. The staged value stays a 24-hour `HH:MM:SS` clock — the columns
 * translate between the display scale and the stored one on every pick.
 *
 * The picker owns only the panel: the row renders the read-only trigger that
 * shows the value, and its Escape guard closes the panel and hands focus back.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import clsx from 'clsx'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { secondPrecision } from './task-timing.ts'
import { PickerPopover } from './PickerPopover.tsx'
import type { TaskManagerKey } from './task-manager-locales.ts'
import css from './ClockPicker.module.css'

/** Row copy of the task manager namespace, as the pickers receive it. */
type Translate = PropsLocale<'schedule.manager'>['t']

/** Padded two-digit clock values from zero through `count - 1`. */
function padded(count: number): readonly string[] {
  return Array.from({ length: count }, (_value, index) => String(index).padStart(2, '0'))
}

/** The 12-scale hour column, one through twelve. */
const HOURS_12 = Array.from({ length: 12 }, (_value, index) => String(index + 1).padStart(2, '0'))
const MINUTES_60 = padded(60)
const SECONDS_60 = padded(60)

/** Two-digit spelling of a 24-scale hour. */
function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** The 12-scale hour a 24-scale hour reads as: 0 and 12 both read 12. */
function hour12(value: number): number {
  return value % 12 === 0 ? 12 : value % 12
}

/** The 24-scale hour one whole-second clock names. */
function clockHour(clock: string): number {
  return Number(clock.slice(0, 2))
}

/** One column's option list with how it reads and rewrites the staged clock. */
interface ClockColumn {
  /** The label row copy names the column by. */
  readonly label: TaskManagerKey
  /** The options the column lists, in display order. */
  readonly options: readonly string[]
  /** The option text one whole-second clock selects in this column. */
  readonly selected: (clock: string) => string
  /** The whole-second clock after picking the option at `index`. */
  readonly apply: (clock: string, index: number) => string
}

/** Hour column: 01–12; the pick keeps the staged value's own meridiem. */
const HOUR_COLUMN: ClockColumn = {
  label: 'timing.hour',
  options: HOURS_12,
  selected: clock => twoDigits(hour12(clockHour(clock))),
  apply: (clock, index) => `${twoDigits(((index + 1) % 12) + (clockHour(clock) < 12 ? 0 : 12))}${clock.slice(2)}`,
}

/** Minute column: the staged clock's own `MM` slice, rewritten in place. */
const MINUTE_COLUMN: ClockColumn = {
  label: 'timing.minute',
  options: MINUTES_60,
  selected: clock => clock.slice(3, 5),
  apply: (clock, index) => {
    const minute = MINUTES_60[index] ?? clock.slice(3, 5)
    return clock.slice(0, 3) + minute + clock.slice(5)
  },
}

/** Second column: the staged clock's own `SS` slice, rewritten in place. */
const SECOND_COLUMN: ClockColumn = {
  label: 'timing.second',
  options: SECONDS_60,
  selected: clock => clock.slice(6, 8),
  apply: (clock, index) => clock.slice(0, 6) + (SECONDS_60[index] ?? clock.slice(6, 8)),
}

/**
 * Meridiem column: the staged hour's own half-day; a pick keeps the displayed
 * hour and moves it across noon, so `12 AM` ↔ `12 PM` and `3 AM` ↔ `3 PM`.
 */
function meridiemColumn(t: Translate): ClockColumn {
  return {
    label: 'timing.meridiem',
    options: [t('timing.am'), t('timing.pm')],
    selected: clock => t(clockHour(clock) < 12 ? 'timing.am' : 'timing.pm'),
    apply: (clock, index) => `${twoDigits((clockHour(clock) % 12) + index * 12)}${clock.slice(2)}`,
  }
}

/**
 * The panel's columns in display order. A cron rule has no seconds field, so
 * its form omits that column; a pick there keeps the staged clock's seconds.
 * @param seconds - whether the panel offers the seconds column.
 * @param t - row copy naming the columns and the meridiem options.
 * @returns hour, minutes, optionally seconds, then AM/PM.
 */
function clockColumns(seconds: boolean, t: Translate): readonly ClockColumn[] {
  return [
    ...(seconds ? [HOUR_COLUMN, MINUTE_COLUMN, SECOND_COLUMN] : [HOUR_COLUMN, MINUTE_COLUMN]),
    meridiemColumn(t),
  ]
}

/** A whole-second clock, the only text a pick composes onto. */
const CLOCK_SECONDS = /^\d{2}:\d{2}:\d{2}$/

/**
 * The `HH:MM:SS` clock a pick composes onto.
 *
 * A value that states no clock at all starts from midnight, so the first pick
 * still submits one complete clock rather than leaving a row empty.
 * @param value - staged clock text.
 * @returns its whole-second clock, or midnight when it states none.
 */
function clockBase(value: string): string {
  const seconds = secondPrecision(value)
  return CLOCK_SECONDS.test(seconds) ? seconds : '00:00:00'
}

/** One option the panel shows as highlighted and holds the keyboard on. */
interface ClockCursor {
  /** Column the keyboard is in, in display order. */
  readonly column: number
  /** Option index inside that column. */
  readonly index: number
}

/** Inputs of the clock picker. */
export interface ClockPickerProps {
  /** Whether the panel is showing. */
  readonly open: boolean
  /** The row's trigger button, which anchors the panel. */
  readonly anchorRef: RefObject<HTMLButtonElement | null>
  /** The staged clock text. */
  readonly value: string
  /** Stage one picked `HH:MM:SS` clock. */
  readonly onPick: (time: string) => void
  /** Dismiss the panel. */
  readonly onClose: () => void
  /**
   * Whether the panel offers the seconds column (default true). A cron rule has
   * no seconds field, so its form hides the column; a pick then keeps the staged
   * clock's own seconds.
   */
  readonly seconds?: boolean
  /** Row copy. */
  readonly t: Translate
}

/**
 * Render the clock panel: 12-scale hours, minutes, optionally seconds, and the
 * meridiem, one scrolling column each.
 * @param props - open state, the trigger, the staged clock, the pick and close callbacks, the seconds-column switch, and row copy.
 * @returns the anchored panel while open, and nothing while closed.
 */
export function ClockPicker({ open, anchorRef, value, onPick, onClose, seconds = true, t }: ClockPickerProps): ReactNode {
  const columns = clockColumns(seconds, t)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const valueRef = useRef(value)
  valueRef.current = value
  const base = clockBase(value)
  const selectedValues = columns.map(column => column.selected(base))
  /** Option index each column's staged value occupies, clamped to the first row. */
  const stagedIndices = (clock: string): readonly number[] =>
    columns.map((column) => {
      const index = column.options.indexOf(column.selected(clock))
      return index < 0 ? 0 : index
    })
  // Each column keeps one focusable entry: the row its own value occupies, so
  // the keyboard reaches minutes, seconds, and the meridiem, and each column's
  // arrows walk from the value it shows. The live cursor adds the row the
  // keyboard moved onto while it stays inside that column.
  const selectedIndices = stagedIndices(base)
  const [cursor, setCursor] = useState<ClockCursor>({ column: 0, index: selectedIndices[0] ?? 0 })

  // Opening starts on the clock the row shows, with every column scrolled to
  // that value: the first arrow key then walks from the current time in the
  // column the keyboard enters rather than from midnight.
  useEffect(() => {
    if (!open) return
    const indices = stagedIndices(clockBase(valueRef.current))
    setCursor({ column: 0, index: indices[0] ?? 0 })
    for (const [at, index] of indices.entries()) {
      refs.current.get(`${at}:${index}`)?.scrollIntoView({ block: 'nearest' })
    }
    // `stagedIndices` follows the columns, which follow `seconds` and `t`.
  }, [open])

  // The cursor owns the keyboard: a pick, an arrow, or the open itself moves the
  // highlight and takes focus with it, so the panel keeps the keyboard until it
  // closes.
  useEffect(() => {
    if (!open) return
    refs.current.get(`${cursor.column}:${cursor.index}`)?.focus()
  }, [open, cursor])

  /**
   * Stage the option the keyboard or pointer is on and move the cursor onto it.
   * @param column - column index in display order.
   * @param index - option index inside that column.
   */
  const pick = (column: number, index: number): void => {
    const picked = columns[column]
    if (picked === undefined) return
    setCursor({ column, index })
    onPick(clockBase(picked.apply(base, index)))
  }

  /**
   * Move inside one column, move between columns, or stage the option the
   * keyboard is on.
   * @param event - keydown from that option.
   * @param column - column index in display order.
   * @param index - option index inside that column.
   * @param count - number of options in the column.
   */
  const onOptionKeyDown = (
    event: KeyboardEvent<HTMLDivElement>, column: number, index: number, count: number,
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(column, index)
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const target = column + (event.key === 'ArrowRight' ? 1 : -1)
      const nextColumn = columns[target]
      if (nextColumn === undefined) return
      // Columns hold different counts, so the row carried across stays inside
      // the target column.
      setCursor({ column: target, index: Math.min(index, nextColumn.options.length - 1) })
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setCursor({ column, index: event.key === 'Home' ? 0 : count - 1 })
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    setCursor({ column, index: Math.min(Math.max(index + step, 0), count - 1) })
  }

  return <PickerPopover
    open={open}
    anchorRef={anchorRef}
    label={t('timing.time')}
    className={css.clock}
    onClose={onClose}
  >
    {columns.map((column, at) => (
      <div key={column.label} role="listbox" aria-label={t(column.label)} className={css.column}>
        {column.options.map((option, index) => (
          <div
            key={option}
            ref={(element) => {
              const key = `${at}:${index}`
              if (element === null) refs.current.delete(key)
              else refs.current.set(key, element)
            }}
            role="option"
            aria-selected={option === selectedValues[at]}
            tabIndex={
              (cursor.column === at ? cursor.index : selectedIndices[at]) === index ? 0 : -1
            }
            className={clsx(css.option, option === selectedValues[at] && css.selected)}
            onClick={() => { pick(at, index) }}
            onKeyDown={(event) => { onOptionKeyDown(event, at, index, column.options.length) }}
          >{option}</div>
        ))}
      </div>
    ))}
  </PickerPopover>
}
