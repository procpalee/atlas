import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selAllTags } from '../store/store'
import type { Task } from '../types'

/** 페이지 공용 태스크 필터 — 프로젝트(워크스페이스)·서브프로젝트·태그. localStorage(storageKey)에 영속. */
export interface TaskFilterState { ws: string; proj: string; tag: string }

export function useTaskFilter(storageKey: string) {
  const [f, setF] = useState<TaskFilterState>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storageKey) ?? '') as Partial<TaskFilterState>
      return { ws: v.ws ?? '', proj: v.proj ?? '', tag: v.tag ?? '' }
    } catch {
      return { ws: '', proj: '', tag: '' }
    }
  })
  const set = (patch: Partial<TaskFilterState>) =>
    setF(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  const pass = (t: Task) => {
    if (f.ws === '__none') { if (t.workspace_id) return false }
    else if (f.ws && t.workspace_id !== f.ws) return false
    if (f.proj && t.project_id !== f.proj) return false
    if (f.tag && !(t.tags ?? []).includes(f.tag)) return false
    return true
  }
  const active = !!(f.ws || f.proj || f.tag)
  return { f, set, pass, active, reset: () => set({ ws: '', proj: '', tag: '' }) }
}

export default function FilterBar({ filter }: { filter: ReturnType<typeof useTaskFilter> }) {
  const workspaces = useStore(s => s.workspaces)
  const projects = useStore(s => s.projects)
  const allTags = useStore(useShallow(selAllTags)) // selAllTags는 매번 새 배열 — useShallow 필수
  const { f, set, active, reset } = filter
  const projOptions = f.ws && f.ws !== '__none' ? projects.filter(p => p.workspace_id === f.ws) : projects

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <select
        className="input !h-7 !w-auto !py-0 !text-[13px]"
        value={f.ws}
        onChange={e => set({ ws: e.target.value, proj: '' })}
        title="프로젝트 필터"
      >
        <option value="">전체 프로젝트</option>
        <option value="__none">프로젝트 없음</option>
        {workspaces.filter(w => !w.archived).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <select
        className="input !h-7 !w-auto !py-0 !text-[13px]"
        value={f.proj}
        onChange={e => set({ proj: e.target.value })}
        title="서브프로젝트 필터"
      >
        <option value="">전체 서브프로젝트</option>
        {projOptions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      {allTags.length > 0 && (
        <select
          className="input !h-7 !w-auto !py-0 !text-[13px]"
          value={f.tag}
          onChange={e => set({ tag: e.target.value })}
          title="태그 필터"
        >
          <option value="">전체 태그</option>
          {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
        </select>
      )}
      {active && (
        <button className="btn !px-1.5 !py-0.5 !text-[12px]" onClick={reset} title="필터 초기화">초기화</button>
      )}
    </span>
  )
}
