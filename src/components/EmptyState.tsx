import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** 공용 빈 상태 — 아이콘 + 제목 + 힌트(옵션) + 행동 버튼(옵션) */
export default function EmptyState({ icon: Icon, title, hint, action, className = '' }: {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-1.5 py-10 text-center ${className}`}>
      <Icon size={26} strokeWidth={1.5} className="text-zinc-300 dark:text-zinc-600" />
      <div className="text-[14px] font-medium text-zinc-400">{title}</div>
      {hint && <div className="text-[12.5px] text-zinc-400/80 dark:text-zinc-500">{hint}</div>}
      {action}
    </div>
  )
}
