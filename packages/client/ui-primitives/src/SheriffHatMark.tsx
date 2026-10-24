import type { IconProps } from './icons/props.ts'

/** Native artboard of {@link SHERIFF_HAT_PATH} and {@link SHERIFF_HAT_BRIM_PATH}. */
export const SHERIFF_HAT_VIEWBOX = { width: 48, height: 30 }

/**
 * The sheriff-hat crown: flat-topped crown with the center peak, the hatband
 * knocked out as a second subpath, and the star badge folded into the same
 * compound path. Fill with `fill-rule="evenodd"` so the band shows the surface
 * behind the glyph while the star stays solid.
 */
export const SHERIFF_HAT_PATH =
  'M14.6 21.3C14.4 16 14.8 11 15.6 7.5C16.2 5 18 3.8 20 4C22 4.2 23 5.5 24 6'
  + 'C25 5.5 26 4.2 28 4C30 3.8 31.8 5 32.4 7.5C33.2 11 33.6 16 33.4 21.3'
  + 'C29 22 19 22 14.6 21.3Z'
  + 'M14.75 16.3C19 16.9 29 16.9 33.25 16.3L33.35 18.6C29 19.2 19 19.2 14.65 18.6Z'
  + 'M24 7.8L24.82 10.07L27.23 10.15L25.33 11.63L26 13.95L24 12.6'
  + 'L22 13.95L22.67 11.63L20.77 10.15L23.18 10.07Z'

/** The wide curled brim, drawn beside the crown. */
export const SHERIFF_HAT_BRIM_PATH =
  'M1.5 13.5C3 19.5 11 26.5 24 26.5C37 26.5 45 19.5 46.5 13.5'
  + 'C45.6 13.2 44.8 14.6 43.6 16.2C40 20.4 33 22.6 24 22.8C15 22.6 8 20.4 4.4 16.2'
  + 'C3.2 14.6 2.4 13.2 1.5 13.5Z'

/**
 * Render the sheriff-hat mark.
 * @param props.size - width in px (default 24; height keeps the 48:30 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the mark svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function SheriffHatMark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={(size * SHERIFF_HAT_VIEWBOX.height) / SHERIFF_HAT_VIEWBOX.width}
      className={className}
      viewBox={`0 0 ${SHERIFF_HAT_VIEWBOX.width} ${SHERIFF_HAT_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={SHERIFF_HAT_PATH} fill="currentColor" fillRule="evenodd" />
      <path d={SHERIFF_HAT_BRIM_PATH} fill="currentColor" />
    </svg>
  )
}
