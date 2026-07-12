import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'md' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-canon-denim text-white border-transparent hover:bg-canon-denim/90',
  secondary: 'bg-canon-forest text-white border-transparent hover:bg-canon-forest/90',
  ghost: 'bg-transparent text-canon-ink border-canon-border hover:bg-canon-sand',
  danger: 'bg-canon-signal text-white border-transparent hover:bg-canon-signal/90',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  md: 'px-[18px] py-[10px] text-[0.72rem]',
  sm: 'px-3.5 py-2 text-[0.7rem]',
}

export function Button({ variant = 'primary', size = 'md', className, disabled, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono tracking-[0.08em] uppercase',
        'rounded-control border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canon-denim',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  )
}
