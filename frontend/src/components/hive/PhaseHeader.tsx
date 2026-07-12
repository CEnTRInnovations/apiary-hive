interface PhaseHeaderProps {
  phase: string
  title: string
  description: string
}

export function PhaseHeader({ phase, title, description }: PhaseHeaderProps) {
  return (
    <div className="space-y-1 pb-4 border-b border-canon-border">
      <p className="font-mono text-[0.65rem] font-bold tracking-[0.14em] uppercase text-canon-muted">{phase}</p>
      <h1 className="font-serif text-h2 font-medium text-canon-foreground">{title}</h1>
      <p className="text-sm text-canon-muted">{description}</p>
    </div>
  )
}
