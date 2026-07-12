import type { ReactNode } from 'react'

interface EmptyStateProps {
  heading: string
  description: string
  action?: ReactNode
}

export function EmptyState({ heading, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-canon-border bg-canon-paper-bright px-6 py-14 text-center">
      <img src="/apiary_hive-logo.png" alt="" className="h-16 w-16 object-contain opacity-80 mb-1" />
      <h3 className="font-serif text-lede text-canon-muted">{heading}</h3>
      <div className="h-[3px] w-9 rounded-full bg-canon-clay" />
      <p className="max-w-[340px] font-sans text-sm text-canon-muted">{description}</p>
      {action}
    </div>
  )
}
