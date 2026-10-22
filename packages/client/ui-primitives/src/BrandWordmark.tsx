import type { IconProps } from './icons/props.ts'
import { SHERIFF_HAT_PATH, SHERIFF_HAT_STAR_PATH } from './SheriffHatMark.tsx'

/** Display options for the official brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading sheriff-hat mark; defaults to true. */
  includeMark?: boolean | undefined
}

/** Name-artwork width in the 24-tall coordinate system. */
const NAME_WIDTH = 100
/** Full lockup width (mark + gap + name) in the 24-tall coordinate system. */
const FULL_WIDTH = 126

/*
 * "FIFECODE" in the western slab letterforms: stems and bars are merged into
 * one nonzero fill path (clockwise rect subpaths union on overlap); the round
 * bowls (C, O, D) ride heavy currentColor strokes with slab terminal blocks,
 * matching the stem weight.
 */
const LETTER_FILL_PATH = 'M1.5 6.7h3v10.6h-3ZM0.3 5h5.4v1.7h-5.4ZM0.3 17.3h5.4v1.7h-5.4Z'
  + 'M4.5 5h5.5v2.9h-5.5ZM8.8 5h1.2v3.9h-1.2ZM4.5 10.6h2.8v2.3h-2.8Z'
  + 'M13.4 6.7h3v10.6h-3ZM12.2 5h5.4v1.7h-5.4ZM12.2 17.3h5.4v1.7h-5.4Z'
  + 'M19.8 6.7h3v10.6h-3ZM18.6 5h5.4v1.7h-5.4ZM18.6 17.3h5.4v1.7h-5.4Z'
  + 'M22.8 5h5.5v2.9h-5.5ZM27.1 5h1.2v3.9h-1.2ZM22.8 10.6h2.8v2.3h-2.8Z'
  + 'M31.7 6.7h3v10.6h-3ZM30.5 5h5.4v1.7h-5.4ZM30.5 17.3h5.4v1.7h-5.4Z'
  + 'M34.7 5h5.5v2.9h-5.5ZM39 5h1.2v3.9h-1.2ZM34.7 10.5h2.5v2.5h-2.5Z'
  + 'M34.7 16.1h5.5v2.9h-5.5ZM39 15.1h1.2v3.9h-1.2Z'
  + 'M50.5 5h2v1.9h-2ZM50.5 17.1h2v1.9h-2Z'
  + 'M73.9 6.7h3v10.6h-3ZM72.7 5h5.4v1.7h-5.4ZM72.7 17.3h5.4v1.7h-5.4Z'
  + 'M89.8 6.7h3v10.6h-3ZM88.6 5h5.4v1.7h-5.4ZM88.6 17.3h5.4v1.7h-5.4Z'
  + 'M92.8 5h5.5v2.9h-5.5ZM97.1 5h1.2v3.9h-1.2ZM92.8 10.5h2.5v2.5h-2.5Z'
  + 'M92.8 16.1h5.5v2.9h-5.5ZM97.1 15.1h1.2v3.9h-1.2Z'

/** The C bowl: open ring struck at stem weight, terminals seated in the slab blocks above. */
const C_BOWL_PATH = 'M51.63 6.27A5.1 7 0 1 0 51.63 17.73'

/** The D bowl beside its stem. */
const D_BOWL_PATH = 'M76.9 6.6C81.4 5.7 85.5 7.8 85.5 12C85.5 16.2 81.4 18.3 76.9 17.4'

/**
 * Render the full brand wordmark.
 * @param props.size - height in px (default 24; width follows the selected artwork).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading sheriff-hat mark.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const width = includeMark ? FULL_WIDTH : NAME_WIDTH
  return (
    <svg
      width={(size * width) / 24}
      height={size}
      className={className}
      viewBox={includeMark ? `0 0 ${FULL_WIDTH} 24` : `0 0 ${NAME_WIDTH} 24`}
      fill="none"
      aria-hidden="true"
    >
      {includeMark && (
        <g transform="translate(-0.2 3.7) scale(0.97)">
          <path d={SHERIFF_HAT_PATH} fill="currentColor" fillRule="evenodd" />
          <path d={SHERIFF_HAT_STAR_PATH} fill="currentColor" />
        </g>
      )}
      <g transform={includeMark ? 'translate(27.4 0)' : undefined}>
        <path d={LETTER_FILL_PATH} fill="currentColor" />
        <path d={C_BOWL_PATH} stroke="currentColor" strokeWidth={3.1} />
        <ellipse cx={64} cy={12} rx={6.5} ry={7} stroke="currentColor" strokeWidth={3.1} />
        <path d={D_BOWL_PATH} stroke="currentColor" strokeWidth={2.9} />
      </g>
    </svg>
  )
}
