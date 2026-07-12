import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type CardVariant = 'surface' | 'fieldset'
type CardDensity = 'comfortable' | 'compact'

interface CardProps {
  variant?: CardVariant
  density?: CardDensity
  legend?: string
  className?: string
  children: ReactNode
}

const DENSITY_PADDING: Record<CardDensity, string> = {
  comfortable: 'p-[22px]',
  compact: 'p-3.5',
}

export function Card({ variant = 'surface', density = 'comfortable', legend, className, children }: CardProps) {
  if (variant === 'fieldset') {
    return (
      <div className={cn('relative rounded-card border-2 border-canon-border', DENSITY_PADDING[density], className)}>
        {legend && (
          <span className="absolute -top-[11px] left-4 bg-canon-paper px-2 font-mono text-[0.62rem] font-bold uppercase tracking-[0.06em] text-canon-ink">
            {legend}
          </span>
        )}
        {children}
      </div>
    )
  }
  return (
    <div
      className={cn(
        'rounded-card border border-canon-border bg-canon-paper-bright shadow-field',
        DENSITY_PADDING[density],
        className,
      )}
    >
      {children}
    </div>
  )
}
