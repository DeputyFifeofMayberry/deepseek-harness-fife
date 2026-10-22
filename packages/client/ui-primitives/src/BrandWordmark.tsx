import { useId } from 'react'
import type { IconProps } from './icons/props.ts'
import { SHERIFF_HAT_BRIM_PATH, SHERIFF_HAT_PATH } from './SheriffHatMark.tsx'

/** Display options for the FIFECODE brand wordmark. */
export type BrandWordmarkProps = IconProps

/** Lockup artboard width and height in user units. */
const ARTBOARD = { width: 106, height: 26.5 }

/*
 * "FIFECODE" in the western slab letterforms: stems and bars are merged into
 * one nonzero fill path (clockwise rect subpaths union on overlap); the round
 * bowls (C, O, D) ride heavy currentColor strokes with slab terminal blocks,
 * matching the stem weight.
 */
const FIFE_FILL_PATH =
  'M1.5 6.7h3v10.6h-3ZM0.3 5h5.4v1.7h-5.4ZM0.3 17.3h5.4v1.7h-5.4Z'
  + 'M4.5 5h5.5v2.9h-5.5ZM8.8 5h1.2v3.9h-1.2ZM4.5 10.6h2.8v2.3h-2.8Z'
  + 'M13.4 6.7h3v10.6h-3ZM12.2 5h5.4v1.7h-5.4ZM12.2 17.3h5.4v1.7h-5.4Z'
  + 'M19.8 6.7h3v10.6h-3ZM18.6 5h5.4v1.7h-5.4ZM18.6 17.3h5.4v1.7h-5.4Z'
  + 'M22.8 5h5.5v2.9h-5.5ZM27.1 5h1.2v3.9h-1.2ZM22.8 10.6h2.8v2.3h-2.8Z'
  + 'M31.7 6.7h3v10.6h-3ZM30.5 5h5.4v1.7h-5.4ZM30.5 17.3h5.4v1.7h-5.4Z'
  + 'M34.7 5h5.5v2.9h-5.5ZM39 5h1.2v3.9h-1.2ZM34.7 10.5h2.5v2.5h-2.5Z'
  + 'M34.7 16.1h5.5v2.9h-5.5ZM39 15.1h1.2v3.9h-1.2Z'

/** The C slab terminals; the bowl stroke below seats between them. */
const C_BLOCKS_PATH = 'M50.5 5h2v1.9h-2ZM50.5 17.1h2v1.9h-2Z'

/** The C bowl: open ring struck at stem weight. */
const C_BOWL_PATH = 'M51.63 6.27A5.1 7 0 1 0 51.63 17.73'

/** The D stem and its slab blocks. */
const D_BLOCKS_PATH = 'M73.9 6.7h3v10.6h-3ZM72.7 5h5.4v1.7h-5.4ZM72.7 17.3h5.4v1.7h-5.4Z'

/** The D bowl beside its stem. */
const D_BOWL_PATH = 'M76.9 6.6C81.4 5.7 85.5 7.8 85.5 12C85.5 16.2 81.4 18.3 76.9 17.4'

/** The E stem and its slab arms. */
const E_BLOCKS_PATH =
  'M89.8 6.7h3v10.6h-3ZM88.6 5h5.4v1.7h-5.4ZM88.6 17.3h5.4v1.7h-5.4Z'
  + 'M92.8 5h5.5v2.9h-5.5ZM97.1 5h1.2v3.9h-1.2ZM92.8 10.5h2.5v2.5h-2.5Z'
  + 'M92.8 16.1h5.5v2.9h-5.5ZM97.1 15.1h1.2v3.9h-1.2Z'

/** The star inside the lasso-ring O. */
const O_STAR_PATH =
  'M64 8.4L64.88 10.79L67.42 10.89L65.43 12.46L66.12 14.91L64 13.5'
  + 'L61.88 14.91L62.57 12.46L60.58 10.89L63.12 10.79Z'

/** The lasso tail leaving the O toward the spur. */
const TAIL_PATH = 'M68.2 17.4C71.5 21 80 22.4 98.5 21.4'

/** The spur rowel spokes around its hub. */
const SPUR_SPOKES_PATH =
  'M100.2 21.3L102.1 21.3M100.2 21.3L101.15 22.95M100.2 21.3L99.25 22.95'
  + 'M100.2 21.3L99.25 19.65M100.2 21.3L101.15 19.65'

/** Knots riding the O star's five points. */
const O_BALLS = [
  { cx: 64, cy: 8.4 },
  { cx: 67.42, cy: 10.89 },
  { cx: 66.12, cy: 14.91 },
  { cx: 61.88, cy: 14.91 },
  { cx: 60.58, cy: 10.89 },
] as const

/** The bullet hole punched through the first F. */
const HOLE_PATH =
  'M15.84 11.47L15.57 11.87L15.52 12.39L14.99 12.21L14.56 12.43L14.29 12.08'
  + 'L13.87 11.74L14.29 11.35L14.36 10.91L14.82 11.01L15.27 10.69L15.48 11.14Z'

/** Cracks radiating from the hole. */
const HOLE_CRACKS_PATH = 'M14.9 11.6L14.6 10.1L14.7 9M14.9 11.6L15.25 13.2L15.1 14.2M14.9 11.6L15.9 11.9'

/**
 * Render the full brand wordmark: the slab FIFECODE letterforms with the hat
 * perched on the first F, the bullet hole through it, and the lasso-ring O.
 * @param props.size - height in px (default 24; width follows the lockup ratio).
 * @param props.className - extra class for layout placement.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className }: BrandWordmarkProps) {
  const holeMaskId = `dsh-brand-wordmark-${useId().replaceAll(':', '')}`
  return (
    <svg
      width={(size * ARTBOARD.width) / ARTBOARD.height}
      height={size}
      className={className}
      viewBox="-3 -3.5 106 26.5"
      fill="none"
      aria-hidden="true"
    >
      <path d={C_BLOCKS_PATH} fill="currentColor" />
      <path d={C_BOWL_PATH} stroke="currentColor" strokeWidth={3.1} />
      <path d={D_BLOCKS_PATH} fill="currentColor" />
      <path d={D_BOWL_PATH} stroke="currentColor" strokeWidth={2.9} />
      <path d={E_BLOCKS_PATH} fill="currentColor" />
      <g transform="rotate(-8 5 4) translate(-1.9 -2.4) scale(0.3)">
        <path d={SHERIFF_HAT_PATH} fill="currentColor" fillRule="evenodd" />
        <path d={SHERIFF_HAT_BRIM_PATH} fill="currentColor" />
      </g>
      <path d={O_STAR_PATH} fill="currentColor" />
      <mask id={holeMaskId} maskUnits="userSpaceOnUse" x={-20} y={-20} width={160} height={60}>
        <rect x={-20} y={-20} width={160} height={60} fill="white" />
        <path d={HOLE_PATH} fill="black" />
        <path d={HOLE_CRACKS_PATH} fill="none" stroke="black" strokeWidth={0.2} strokeLinecap="round" />
      </mask>
      <path d={FIFE_FILL_PATH} fill="currentColor" mask={`url(#${holeMaskId})`} />
      <ellipse cx={64} cy={12} rx={6.5} ry={7} stroke="currentColor" strokeWidth={2.8} strokeDasharray="1.5 0.45" />
      <path d={TAIL_PATH} stroke="currentColor" strokeWidth={1.7} strokeDasharray="1.3 0.4" />
      <ellipse cx={68.9} cy={18} rx={1.6} ry={1.05} transform="rotate(40 68.9 18)" fill="currentColor" />
      <circle cx={100.2} cy={21.3} r={0.8} fill="currentColor" />
      <path d={SPUR_SPOKES_PATH} stroke="currentColor" strokeWidth={0.55} strokeLinecap="round" />
      <g fill="currentColor">
        {O_BALLS.map(ball => <circle key={`${ball.cx}-${ball.cy}`} cx={ball.cx} cy={ball.cy} r={0.6} />)}
      </g>
    </svg>
  )
}
