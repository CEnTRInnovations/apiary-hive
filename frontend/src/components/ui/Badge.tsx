import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type BadgeAccent = 'denim' | 'forest' | 'brown' | 'clay' | 'signal' | 'sage' | 'plum' | 'neutral'

interface BadgeProps {
  accent?: BadgeAccent
  solid?: boolean
  className?: string
  children: ReactNode
}

const TINT_CLASSES: Record<BadgeAccent, string> = {
  denim: 'bg-canon-denim/10 border-canon-denim/25 text-canon-denim',
  forest: 'bg-canon-forest/10 border-canon-forest/25 text-canon-forest',
  brown: 'bg-canon-brown/10 border-canon-brown/25 text-canon-brown',
  clay: 'bg-canon-clay/10 border-canon-clay/25 text-canon-clay',
  signal: 'bg-canon-signal/10 border-canon-signal/25 text-canon-signal',
  sage: 'bg-canon-sage/10 border-canon-sage/25 text-canon-sage',
  plum: 'bg-canon-plum/10 border-canon-plum/25 text-canon-plum',
  neutral: 'bg-canon-sand border-canon-border text-canon-muted',
}

const SOLID_CLASSES: Record<BadgeAccent, string> = {
  denim: 'bg-canon-denim text-white border-transparent',
  forest: 'bg-canon-forest text-white border-transparent',
  brown: 'bg-canon-brown text-white border-transparent',
  clay: 'bg-canon-clay text-white border-transparent',
  signal: 'bg-canon-signal text-white border-transparent',
  sage: 'bg-canon-sage text-white border-transparent',
  plum: 'bg-canon-plum text-white border-transparent',
  neutral: 'bg-canon-muted text-white border-transparent',
}

export function Badge({ accent = 'neutral', solid = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.05em] border',
        solid ? SOLID_CLASSES[accent] : TINT_CLASSES[accent],
        className,
      )}
    >
      {children}
    </span>
  )
}
