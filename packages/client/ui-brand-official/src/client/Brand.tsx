import { BrandBadgeMark, BrandWordmark } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the FIFECODE badge mark.
 */
export function OfficialBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <BrandBadgeMark size={size} />
}

/**
 * Render the official name artwork, which carries its own hat mark.
 * @returns the FIFECODE wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark />
}
