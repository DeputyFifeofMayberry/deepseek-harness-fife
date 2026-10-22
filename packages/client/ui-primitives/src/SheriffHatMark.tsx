import type { IconProps } from './icons/props.ts'

/** Native viewBox of {@link SHERIFF_HAT_PATH} (width and height in user units). */
export const SHERIFF_HAT_VIEWBOX = { width: 24, height: 17.5 }

/**
 * The sheriff-hat body: campaign-hat silhouette (flat-topped crown with the
 * center peak, wide curled brim) with the hatband knocked out as a second
 * subpath — fill with `fill-rule="evenodd"` so the band shows the surface
 * behind the glyph on any background.
 */
export const SHERIFF_HAT_PATH =
  'M0.9 12.9C2.7 11.9 4.5 11.35 6.5 11.1C6.4 9.4 6.55 6.6 7.2 4.9'
  + 'C7.55 4.2 8.1 3.85 9.2 3.7C10.4 3.62 11.2 3.58 11.7 3.5'
  + 'C11.9 3.28 12.1 3.28 12.3 3.5C12.8 3.58 13.6 3.62 14.8 3.7'
  + 'C15.9 3.85 16.45 4.2 16.8 4.9C17.45 6.6 17.6 9.4 17.5 11.1'
  + 'C19.5 11.35 21.3 11.9 23.1 12.9C23.35 13.1 23.2 13.5 22.5 13.65'
  + 'C19.2 14.3 15.4 14.7 12 14.7C8.6 14.7 4.8 14.3 1.5 13.65'
  + 'C0.8 13.5 0.65 13.1 0.9 12.9Z'
  + 'M7.3 8.5C9.7 8.25 14.3 8.25 16.7 8.5C16.95 9.05 16.95 9.7 16.7 10.25'
  + 'C14.3 10 9.7 10 7.3 10.25C7.05 9.7 7.05 9.05 7.3 8.5Z'

/** The star badge riding the hatband, exported for consumers that compose their own svg around the same geometry. */
export const SHERIFF_HAT_STAR_PATH =
  'M12 8.55L12.28 8.97L12.76 9.1L12.45 9.5L12.47 10L12 9.82L11.53 10L11.55 9.5L11.24 9.1L11.72 8.97Z'

/**
 * Render the sheriff-hat mark.
 * @param props.size - width in px (default 24; height keeps the 24:17.5 ratio).
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
      <path d={SHERIFF_HAT_STAR_PATH} fill="currentColor" />
    </svg>
  )
}
