import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type ChipAccent = 'denim' | 'forest' | 'brown' | 'clay' | 'signal' | 'sage' | 'plum'

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  accent?: ChipAccent
}

const ACCENT_CLASSES: Record<ChipAccent, string> = {
  denim: 'bg-canon-denim/[0.07] border-canon-denim/35 text-canon-denim',
  forest: 'bg-canon-forest/[0.07] border-canon-forest/35 text-canon-forest',
  brown: 'bg-canon-brown/[0.07] border-canon-brown/35 text-canon-brown',
  clay: 'bg-canon-clay/[0.07] border-canon-clay/35 text-canon-clay',
  signal: 'bg-canon-signal/[0.07] border-canon-signal/35 text-canon-signal',
  sage: 'bg-canon-sage/[0.07] border-canon-sage/35 text-canon-sage',
  plum: 'bg-canon-plum/[0.07] border-canon-plum/35 text-canon-plum',
}

export function Chip({ accent, className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-3.5 py-[5px] font-sans text-[0.82rem]',
        accent ? ACCENT_CLASSES[accent] : 'bg-canon-paper-bright border-canon-border text-canon-foreground',
        className,
      )}
      {...props}
    />
  )
}
