import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Badge } from './Badge'
import { cn } from '../../lib/cn'

interface AiInsightStripProps {
  category?: string
  categoryAccent?: 'forest' | 'clay' | 'signal'
  confidence?: string | null
  defaultOpen?: boolean
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function AiInsightStrip({
  category,
  categoryAccent = 'clay',
  confidence,
  defaultOpen = true,
  actions,
  children,
  className,
}: AiInsightStripProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={cn(
        'rounded-card border border-canon-border border-t-[3px] border-t-canon-denim bg-canon-paper-bright overflow-hidden',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-2.5">
        <Badge accent="denim">
          <Icon name="auto_awesome" size={13} className="mr-1" />
          AI insight
        </Badge>
        {category && (
          <Badge accent={categoryAccent} solid>
            {category}
          </Badge>
        )}
        {confidence && (
          <span className="font-mono text-[0.68rem] text-canon-muted">Confidence: {confidence}</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-wide text-canon-muted hover:text-canon-foreground transition-colors"
        >
          {open ? 'Hide Details' : 'Show Details'}
          <Icon name="expand_less" size={14} className={cn('transition-transform', !open && 'rotate-180')} />
        </button>
      </div>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
      {actions && <div className="flex gap-2 px-4 py-3 border-t border-canon-border">{actions}</div>}
    </div>
  )
}
