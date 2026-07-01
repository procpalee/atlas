import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TaskRow from './TaskRow'
import { useStore } from '../store/store'
import type { Task } from '../types'

/** 완료 태스크 접이식 섹션 — Today의 Done 그룹 패턴 공용화 (접힘 상태는 storageKey로 영속) */
export default function DoneSection({ tasks, storageKey, title = 'Done', defaultOpen = false, className = '' }: {
  tasks: Task[]
  storageKey: string
  title?: string
  defaultOpen?: boolean
  className?: string
}) {
  const openDetail = useStore(s => s.openDetail)
  const [open, setOpen] = useState(() => {
    const v = localStorage.getItem(storageKey)
    return v === null ? defaultOpen : v === '1'
  })
  const toggle = () => setOpen(o => { localStorage.setItem(storageKey, o ? '0' : '1'); return !o })

  if (!tasks.length) return null
  return (
    <section className={className}>
      <button onClick={toggle} className="mt-1 mb-1.5 flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/60">
        {open ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronRight size={14} className="text-zinc-400" />}
        <span className="text-[14px] font-bold tracking-tight">{title}</span>
        <span className="text-[12.5px] font-semibold text-zinc-400">{tasks.length}</span>
      </button>
      {open && tasks.map(t => <TaskRow key={t.id} task={t} onOpen={openDetail} />)}
    </section>
  )
}
