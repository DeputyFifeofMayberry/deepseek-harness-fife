import type { IconProps } from './icons/props.ts'
import { SHERIFF_HAT_BRIM_PATH, SHERIFF_HAT_PATH } from './SheriffHatMark.tsx'

/** Artwork side in user units for the square badge artboard. */
const BADGE_SIDE = 48

/** The five-point badge star seated inside the ring. */
const BADGE_STAR_PATH =
  'M24 23L25.47 26.98L29.71 27.15L26.38 29.77L27.53 33.85L24 31.5'
  + 'L20.47 33.85L21.62 29.77L18.29 27.15L22.53 26.98Z'

/** Rope knots riding the star's five points. */
const BADGE_BALLS = [
  { cx: 24, cy: 23 },
  { cx: 29.71, cy: 27.15 },
  { cx: 27.53, cy: 33.85 },
  { cx: 20.47, cy: 33.85 },
  { cx: 18.29, cy: 27.15 },
] as const

/**
 * Render the badge mark: the sheriff hat perched on a lasso ring around the
 * badge star. Use it where the wordmark is too wide, such as app and favicon
 * marks or the collapsed sidebar rail.
 * @param props.size - width and height in px (default 24; the artboard is square).
 * @param props.className - extra class for layout placement.
 * @returns the badge svg (aria-hidden decorative brand art).
 */
export function BrandBadgeMark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox={`0 0 ${BADGE_SIDE} ${BADGE_SIDE}`}
      fill="none"
      aria-hidden="true"
    >
      <circle cx={24} cy={29} r={11} stroke="currentColor" strokeWidth={3.2} />
      <path d={BADGE_STAR_PATH} fill="currentColor" />
      <g fill="currentColor">
        {BADGE_BALLS.map(ball => <circle key={`${ball.cx}-${ball.cy}`} cx={ball.cx} cy={ball.cy} r={0.9} />)}
      </g>
      <g transform="rotate(-8 24 12) translate(10.8 2.8) scale(0.55)">
        <path d={SHERIFF_HAT_PATH} fill="currentColor" fillRule="evenodd" />
        <path d={SHERIFF_HAT_BRIM_PATH} fill="currentColor" />
      </g>
    </svg>
  )
}
