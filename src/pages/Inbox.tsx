import { useMemo, useState, type ReactNode } from 'react'
import { Plus, CalendarDays, Folder, CloudMoon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, closestCorners,
  useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore, selInbox, selSomeday, useNavOrder, visibleDone } from '../store/store'
import { parseQuick, daysFromToday, fmtDateShort } from '../lib/dates'
import { between } from '../lib/position'
import type { Task } from '../types'
import TaskRow from '../components/TaskRow'
import DoneSection from '../components/DoneSection'
import EmptyState from '../components/EmptyState'

const NONE = '__none' // 미분류(워크스페이스 없음) 그룹 키
const wsKey = (t: Task) => t.workspace_id ?? NONE

/** 인식된 실행일을 짧은 라벨로 (오늘/내일/모레/M·d) */
function dateLabel(d: string): string {
  const n = daysFromToday(d)
  return n === 0 ? '오늘' : n === 1 ? '내일' : n === 2 ? '모레' : fmtDateShort(d)
}

/** 정렬 가능한 태스크 행 — 거리 임계로 클릭(상세 열기)은 통과, 끌면 재정렬/이동 */
function SortableRow({ task }: { task: Task }) {
  const openDetail = useStore(s => s.openDetail)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-40' : ''}
    >
      <TaskRow task={task} onOpen={openDetail} />
    </div>
  )
}

/** 드롭 영역 — Inbox / Someday */
function DropColumn({ id, active, className, children }: { id: 'inbox' | 'someday'; active: boolean; className?: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl ring-2 transition-colors ${className ?? ''} ${
        isOver ? 'bg-blue-50/70 ring-blue-400/70 dark:bg-blue-950/30' : active ? 'ring-zinc-200/70 dark:ring-zinc-800/70' : 'ring-transparent'
      }`}
    >
      {children}
    </div>
  )
}

export default function InboxPage() {
  const inbox = useStore(useShallow(selInbox))
  const someday = useStore(useShallow(selSomeday))
  const doneInbox = useStore(useShallow((s: Parameters<typeof selInbox>[0]) =>
    s.tasks.filter(t => t.status === 'done' && !t.scheduled_date && !t.someday && visibleDone(t))
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
  ))
  const workspaces = useStore(s => s.workspaces)
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)
  const rebalance = useStore(s => s.rebalance)
  const [text, setText] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [sdOpen, setSdOpen] = useState(() => localStorage.getItem('pd-inbox-someday') !== '0')
  const toggleSd = () => setSdOpen(o => { localStorage.setItem('pd-inbox-someday', o ? '0' : '1'); return !o })
  const sdVisible = sdOpen || dragId != null // 접혀 있어도 드래그 중엔 드롭존 노출

  const parsed = parseQuick(text)
  const submit = () => {
    if (!parsed.title) return
    addTask({ title: parsed.title, scheduled_date: parsed.date, tags: parsed.tags })
    setText('')
  }

  // 워크스페이스 단위로 그룹 (프로젝트는 행의 태그로만 표시). 미분류(워크스페이스 없음) 먼저.
  const { noWs, groups } = useMemo(() => {
    const noWs = inbox.filter(t => !t.workspace_id)
    const byWs = new Map<string, Task[]>()
    for (const t of inbox) {
      if (!t.workspace_id) continue
      if (!byWs.has(t.workspace_id)) byWs.set(t.workspace_id, [])
      byWs.get(t.workspace_id)!.push(t)
    }
    const groups = workspaces
      .filter(w => byWs.has(w.id))
      .map(w => ({ ws: w, tasks: byWs.get(w.id)! }))
    return { noWs, groups }
  }, [inbox, workspaces])

  const inboxIds = useMemo(() => [...noWs, ...groups.flatMap(g => g.tasks)].map(t => t.id), [noWs, groups])
  const somedayIds = useMemo(() => someday.map(t => t.id), [someday])

  // 키보드 내비 순서 (화면 표시 순서 그대로 flat: Inbox → Someday) — Someday는 펼쳤을 때만
  useNavOrder(useMemo(
    () => [...inboxIds, ...(sdOpen ? somedayIds : [])],
    [inboxIds, sdOpen, somedayIds],
  ))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
  const dragTask = dragId ? [...inbox, ...someday].find(t => t.id === dragId) ?? null : null

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null)
    const { active, over } = e
    if (!over) return
    const id = String(active.id)
    const a = [...inbox, ...someday].find(t => t.id === id)
    if (!a) return
    const overId = String(over.id)

    // 1) 목적지(Someday 여부 + Inbox 목표 그룹) + 기준 이웃 결정
    let toSomeday: boolean
    let targetWs: string // inbox일 때 목표 그룹 키
    let neighborId: string | null
    if (overId === 'someday') { toSomeday = true; targetWs = wsKey(a); neighborId = null }
    else if (overId === 'inbox') { toSomeday = false; targetWs = wsKey(a); neighborId = null }
    else {
      const ot = [...inbox, ...someday].find(t => t.id === overId)
      if (!ot) return
      if (ot.someday) { toSomeday = true; targetWs = wsKey(a); neighborId = overId }
      else { toSomeday = false; targetWs = wsKey(ot); neighborId = overId }
    }

    // 2) 목적지 리스트(현재 표시 순) — active 제외
    const destAll = toSomeday ? someday : inbox.filter(t => wsKey(t) === targetWs)
    const list = destAll.filter(t => t.id !== id)

    // 3) 삽입 위치 (같은 리스트 내 이동 방향 보정)
    let insertAt: number
    if (!neighborId) insertAt = list.length
    else {
      const overIdx = list.findIndex(t => t.id === neighborId)
      const fromIdx = destAll.findIndex(t => t.id === id)
      const origOverIdx = destAll.findIndex(t => t.id === neighborId)
      insertAt = fromIdx !== -1 && fromIdx < origOverIdx ? overIdx + 1 : overIdx
    }
    const pos = between(list[insertAt - 1]?.position, list[insertAt]?.position)

    // 4) 적용 — Someday 토글 / (그룹 변경 시) 워크스페이스 재배정 / position
    const patch: Partial<Task> = { someday: toSomeday }
    if (!toSomeday && targetWs !== wsKey(a)) {
      patch.workspace_id = targetWs === NONE ? null : targetWs
      patch.project_id = null // 이전 워크스페이스의 서브프로젝트는 무효
    }
    if (Number.isNaN(pos)) {
      const order = list.map(t => t.id)
      order.splice(insertAt, 0, id)
      updateTask(id, patch)
      rebalance(order, 'position')
    } else {
      updateTask(id, { ...patch, position: pos })
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e => { setDragId(String(e.active.id)); useStore.getState().clearSelected() }} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-5 lg:flex-row lg:items-start">
        {/* 왼쪽 — Inbox */}
        <DropColumn id="inbox" active={dragId != null} className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="mb-4 flex items-baseline gap-3 px-1">
              <h1 className="text-[19px] font-bold tracking-tight">Inbox</h1>
              <span className="text-[13.5px] font-medium text-zinc-400">{inbox.length}건</span>
            </div>

            {/* 빠른 입력 — 모바일에선 + 버튼(전역 캡처)으로 대체되므로 숨김 */}
            <div className="mb-4 hidden items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 md:flex dark:border-zinc-700 dark:bg-zinc-900">
              <Plus size={15} className="shrink-0 text-zinc-400" />
              <input
                data-capture
                className="h-9 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-zinc-400"
                placeholder="생각나는 것을 바로 입력 — Enter"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
              {parsed.date && (
                <span
                  className="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[12px] font-semibold text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                  title={`인식된 실행일: ${parsed.date}`}
                >
                  <CalendarDays size={12} />
                  {dateLabel(parsed.date)}
                </span>
              )}
            </div>

            <SortableContext items={inboxIds} strategy={verticalListSortingStrategy}>
              {noWs.length > 0 && (
                <section className="mb-4">
                  {groups.length > 0 && <GroupHead label="미분류" count={noWs.length} />}
                  {noWs.map(t => <SortableRow key={t.id} task={t} />)}
                </section>
              )}

              {groups.map(({ ws, tasks }) => (
                <section key={ws.id} className="mb-4">
                  <GroupHead label={ws.name} count={tasks.length} />
                  {tasks.map(t => <SortableRow key={t.id} task={t} />)}
                </section>
              ))}
            </SortableContext>

            {inbox.length === 0 && (
              <EmptyState icon={Plus} title="Inbox가 비었습니다 ✓" hint="Ctrl+K로 어디서든 빠르게 캡처할 수 있어요" />
            )}

            <DoneSection tasks={doneInbox} storageKey="pd-inbox-done" className="mt-4" />
          </div>
        </DropColumn>

        {/* 오른쪽 — Someday. 우측 드로어처럼 접고 펼친다(접으면 세로 탭, 드래그 중엔 자동 노출) */}
        <DropColumn id="someday" active={dragId != null} className={sdVisible ? 'lg:w-[500px] lg:shrink-0' : 'lg:w-[46px] lg:shrink-0'}>
          {sdVisible ? (
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 px-1">
                <CloudMoon size={15} className="shrink-0 text-zinc-400" />
                <h2 className="text-[16px] font-bold tracking-tight text-zinc-600 dark:text-zinc-300">Someday</h2>
                <span className="text-[12.5px] font-semibold text-zinc-400">{someday.length}</span>
                <button onClick={toggleSd} className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" title="오른쪽으로 접기">
                  <ChevronRight size={17} />
                </button>
              </div>
              <div className="min-h-[120px] rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-1.5 dark:border-zinc-800 dark:bg-zinc-900/30">
                {someday.length > 0
                  ? (
                    <SortableContext items={somedayIds} strategy={verticalListSortingStrategy}>
                      {someday.map(t => <SortableRow key={t.id} task={t} />)}
                    </SortableContext>
                  )
                  : (
                    <div className="flex h-[110px] items-center justify-center px-4 text-center text-[13px] text-zinc-400">
                      {dragId ? '여기에 놓으면 Someday로 보관' : '언젠가 할 일을 여기로 끌어다 두세요'}
                    </div>
                  )}
              </div>
            </div>
          ) : (
            <button
              onClick={toggleSd}
              title="Someday 펼치기"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-2.5 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:bg-zinc-800/60 lg:min-h-[240px] lg:flex-col lg:py-4"
            >
              <ChevronDown size={16} className="shrink-0 lg:hidden" />
              <ChevronLeft size={16} className="hidden shrink-0 lg:block" />
              <CloudMoon size={15} className="shrink-0" />
              <span className="text-[13.5px] font-bold tracking-tight lg:[writing-mode:vertical-rl]">Someday</span>
              <span className="text-[12px] font-semibold text-zinc-400">{someday.length}</span>
            </button>
          )}
        </DropColumn>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragTask && (
          <div className="pointer-events-none max-w-[420px] rounded-md border border-blue-300 bg-white px-3 py-2 text-[14px] font-medium shadow-lg dark:border-blue-700 dark:bg-zinc-800">
            {dragTask.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function GroupHead({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-0.5 flex items-baseline gap-1.5 px-1.5">
      <Folder size={12} className="shrink-0 self-center text-zinc-400" />
      <span className="text-[13px] font-bold">{label}</span>
      <span className="text-[12px] font-semibold text-zinc-400">{count}</span>
    </div>
  )
}
