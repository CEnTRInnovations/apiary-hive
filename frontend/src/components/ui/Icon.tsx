interface IconProps {
  name: string
  size?: number
  filled?: boolean
  className?: string
}

export function Icon({ name, size = 20, filled = false, className }: IconProps) {
  const classes = ['fn-icon', filled && 'fn-icon-filled', className].filter(Boolean).join(' ')
  return (
    <span className={classes} style={{ fontSize: size }} aria-hidden="true">
      {name}
    </span>
  )
}
