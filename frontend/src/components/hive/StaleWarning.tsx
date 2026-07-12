interface StaleWarningProps {
  message: string
}

export function StaleWarning({ message }: StaleWarningProps) {
  return (
    <div className="rounded-control border border-[#b8c5ca] bg-[#e8edef] px-4 py-3 text-sm text-[#2a353a]">
      {message}
    </div>
  )
}
