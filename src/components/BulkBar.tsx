import { useState } from 'react'
import { SquareCheckBig, CalendarDays, FolderInput, Trash2, X } from 'lucide-react'
import { useStore, beginBatch, endBatch } from '../store/store'
import { choiceDialog, confirmDialog } from '../store/dialogStore'
import PlanPopover from './PlanPopover'
import type { Task } from '../types'

const flash = (m: string) => window.dispatchEvent(new CustomEvent('pd:flash', { detail: m }))

/** 멀티선택 일괄 작업 바 — 선택이 있을 때 하단 고정. 모든 작업은 batch undo(Ctrl+Z 한 번에 복원). */
export default function BulkBar() {
  const selectedIds = useStore(s => s.selectedIds)
  const clearSelected = useStore(s => s.clearSelected)
  const [planOpen, setPlanOpen] = useState(false)
  if (!selectedIds.length) return null

  const st = () => useStore.getState()
  const run = (label: string, fn: (id: string) => void) => {
    const n = selectedIds.length
    beginBatch()
    for (const id of selectedIds) fn(id)
    endBatch(`${n}개 ${label}`)
    clearSelected()
    flash(`${n}개 ${label} — Ctrl+Z로 복원`)
  }

  const completeAll = () =>
    run('완료', id => { const t = st().tasks.find(x => x.id === id); if (t && t.status !== 'done') st().toggleDone(id) })

  const applyPlan = (patch: Partial<Task>) => { setPlanOpen(false); run('일정 변경', id => st().updateTask(id, patch)) }

  const moveProject = async () => {
    const { workspaces, projects } = st()
    const options = [
      { label: '프로젝트 없음 (Inbox)', value: '' },
      ...workspaces.filter(w => !w.archived).flatMap(w => [
        { label: w.name, value: `w:${w.id}` },
        ...projects.filter(p => p.workspace_id === w.id).map(p => ({ label: `　└ ${p.title}`, value: `p:${p.id}` })),
      ]),
    ]
    const v = await choiceDialog({ title: `${selectedIds.length}개 태스크의 프로젝트`, options })
    if (v === null) return
    let patch: Partial<Task>
    if (!v) patch = { project_id: null, workspace_id: null }
    else if (v.startsWith('w:')) patch = { workspace_id: v.slice(2), project_id: null }
    else {
      const pid = v.slice(2)
      const proj = st().projects.find(p => p.id === pid)
      patch = { project_id: pid, workspace_id: proj?.workspace_id ?? null }
    }
    run('프로젝트 이동', id => st().updateTask(id, patch))
  }

  const deleteAll = async () => {
    if (await confirmDialog({ title: '일괄 삭제', message: `선택한 ${selectedIds.length}개 태스크를 삭제할까요?`, confirmLabel: '삭제', danger: true }))
      run('삭제', id => st().deleteTask(id))
  }

  const btn = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'

  return (
    <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] left-1/2 z-[55] flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-zinc-200 bg-white px-1.5 py-1 shadow-xl md:bottom-5 dark:border-zinc-700 dark:bg-zinc-900">
      <span className="px-2 text-[13px] font-semibold text-blue-600 dark:text-blue-400">{selectedIds.length}개 선택</span>
      <button className={btn} onClick={completeAll} title="모두 완료">
        <SquareCheckBig size={14} /> 완료
      </button>
      <span className="relative">
        <button className={btn} onClick={() => setPlanOpen(o => !o)} title="일정 일괄 지정">
          <CalendarDays size={14} /> 일정
        </button>
        {planOpen && <PlanPopover vertical="up" onClose={() => setPlanOpen(false)} onApply={applyPlan} />}
      </span>
      <button className={btn} onClick={() => void moveProject()} title="프로젝트 일괄 이동">
        <FolderInput size={14} /> 프로젝트
      </button>
      <button className={`${btn} !text-red-500 hover:!bg-red-50 dark:hover:!bg-red-950`} onClick={() => void deleteAll()} title="일괄 삭제">
        <Trash2 size={14} /> 삭제
      </button>
      <button
        className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        onClick={clearSelected}
        title="선택 해제 (Esc)"
      >
        <X size={15} />
      </button>
    </div>
  )
}
