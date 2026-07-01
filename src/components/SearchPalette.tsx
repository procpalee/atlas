import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Inbox, Sun, CalendarDays, CalendarClock, CalendarRange, LayoutGrid, Folder, SquareCheckBig, Square, type LucideIcon } from 'lucide-react'
import { useStore } from '../store/store'

/** 전역 검색 팔레트 (Ctrl+F / Ctrl+P) — 뷰·프로젝트 이동 + 태스크(제목·메모) 검색 → 상세 열기 */

const VIEWS: { label: string; path: string; icon: LucideIcon }[] = [
  { label: 'Inbox', path: '/inbox', icon: Inbox },
  { label: 'Today', path: '/', icon: Sun },
  { label: 'This Week', path: '/week', icon: CalendarDays },
  { label: 'Upcoming', path: '/upcoming', icon: CalendarClock },
  { label: 'Calendar', path: '/calendar', icon: CalendarRange },
]

type Item =
  | { kind: 'view'; key: string; label: string; path: string; icon: LucideIcon }
  | { kind: 'ws'; key: string; id: string; label: string }
  | { kind: 'project'; key: string; wsId: string; label: string; ctx: string }
  | { kind: 'task'; key: string; id: string; label: string; done: boolean; ctx: string }

export default function SearchPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const navigate = useNavigate()
  const tasks = useStore(s => s.tasks)
  const workspaces = useStore(s => s.workspaces)
  const projects = useStore(s => s.projects)
  const openDetail = useStore(s => s.openDetail)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && ['f', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pd:search-open', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pd:search-open', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  const { nav, taskItems } = useMemo(() => {
    const query = q.trim().toLowerCase()
    const wsName = (id: string | null) => workspaces.find(w => w.id === id)?.name ?? ''
    const nav: Item[] = []
    const taskItems: Item[] = []
    if (!query) {
      nav.push(...VIEWS.map(v => ({ kind: 'view' as const, key: `v:${v.path}`, label: v.label, path: v.path, icon: v.icon })))
      nav.push(...workspaces.filter(w => !w.archived).map(w => ({ kind: 'ws' as const, key: `w:${w.id}`, id: w.id, label: w.name })))
      return { nav, taskItems }
    }
    nav.push(...VIEWS.filter(v => v.label.toLowerCase().includes(query))
      .map(v => ({ kind: 'view' as const, key: `v:${v.path}`, label: v.label, path: v.path, icon: v.icon })))
    nav.push(...workspaces.filter(w => w.name.toLowerCase().includes(query))
      .map(w => ({ kind: 'ws' as const, key: `w:${w.id}`, id: w.id, label: w.name })))
    nav.push(...projects.filter(p => p.title.toLowerCase().includes(query))
      .map(p => ({ kind: 'project' as const, key: `p:${p.id}`, wsId: p.workspace_id, label: p.title, ctx: wsName(p.workspace_id) })))

    const scored: { t: (typeof tasks)[number]; score: number }[] = []
    for (const t of tasks) {
      const inTitle = t.title.toLowerCase().includes(query)
      const inNotes = !inTitle && t.notes.toLowerCase().includes(query)
      if (!inTitle && !inNotes) continue
      scored.push({ t, score: (inTitle ? 0 : 1) + (t.status === 'done' ? 2 : 0) })
    }
    scored.sort((a, b) => a.score - b.score)
    taskItems.push(...scored.slice(0, 50).map(({ t }) => ({
      kind: 'task' as const, key: `t:${t.id}`, id: t.id, label: t.title, done: t.status === 'done', ctx: wsName(t.workspace_id),
    })))
    return { nav, taskItems }
  }, [q, tasks, workspaces, projects])

  const flat = useMemo(() => [...nav, ...taskItems], [nav, taskItems])

  useEffect(() => { setSel(0) }, [q])
  useEffect(() => {
    listRef.current?.querySelector('[data-sel="1"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null

  const close = () => { setOpen(false); setQ('') }
  const exec = (item: Item | undefined) => {
    if (!item) return
    close()
    if (item.kind === 'task') openDetail(item.id)
    else if (item.kind === 'view') navigate(item.path)
    else if (item.kind === 'ws') navigate(`/w/${item.id}`)
    else navigate(`/w/${item.wsId}`)
  }

  const renderItem = (item: Item, idx: number) => {
    const active = idx === sel
    const base = `flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13.5px] ${
      active ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
    }`
    return (
      <button key={item.key} data-sel={active ? '1' : '0'} className={base} onClick={() => exec(item)} onMouseMove={() => setSel(idx)}>
        {item.kind === 'view' && <item.icon size={14} className="shrink-0 text-zinc-400" />}
        {item.kind === 'ws' && <LayoutGrid size={14} className="shrink-0 text-zinc-400" />}
        {item.kind === 'project' && <Folder size={14} className="shrink-0 text-zinc-400" />}
        {item.kind === 'task' && (item.done ? <SquareCheckBig size={14} className="shrink-0 text-emerald-500" /> : <Square size={14} className="shrink-0 text-zinc-300 dark:text-zinc-600" />)}
        <span className={`min-w-0 flex-1 truncate ${item.kind === 'task' && item.done ? 'text-zinc-400 line-through' : ''}`}>{item.label}</span>
        {'ctx' in item && item.ctx && <span className="shrink-0 text-[11.5px] text-zinc-400">{item.ctx}</span>}
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-3 pt-[max(8vh,env(safe-area-inset-top))] backdrop-blur-[1px] md:p-4 md:pt-[14vh]"
      onMouseDown={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className="w-full max-w-[560px] animate-[panel-in_140ms_ease-out] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Search size={16} className="shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-zinc-400"
            placeholder="검색 — 태스크 제목·메모 · 프로젝트 · 뷰 이동"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(flat.length - 1, s + 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
              else if (e.key === 'Enter') { e.preventDefault(); exec(flat[sel]) }
              else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
            }}
          />
          <kbd className="rounded border border-zinc-200 px-1.5 py-px text-[11px] font-semibold text-zinc-400 dark:border-zinc-700">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-1.5">
          {nav.length > 0 && (
            <>
              <div className="px-2.5 pt-1 pb-0.5 text-[11.5px] font-semibold text-zinc-400">이동</div>
              {nav.map((item, i) => renderItem(item, i))}
            </>
          )}
          {taskItems.length > 0 && (
            <>
              <div className="px-2.5 pt-2 pb-0.5 text-[11.5px] font-semibold text-zinc-400">태스크</div>
              {taskItems.map((item, i) => renderItem(item, nav.length + i))}
            </>
          )}
          {flat.length === 0 && <div className="px-3 py-6 text-center text-[13.5px] text-zinc-400">검색 결과가 없습니다</div>}
        </div>
      </div>
    </div>
  )
}
