import { useMemo } from 'react'
import { addDays, format, startOfWeek, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { BarChart2, CheckCircle2 } from 'lucide-react'
import { useStore } from '../store/store'
import { todayStr, toStr, fmtDate } from '../lib/dates'
import { wsColor, type Task } from '../types'
import TaskRow from '../components/TaskRow'
import EmptyState from '../components/EmptyState'

/** Review — 완료 추이(최근 4주)·프로젝트 진행률·이번 주 완료 회고.
 *  fetchAll이 completed_at 30일 컷오프로 가져오므로 28일 차트는 추가 조회 불필요
 *  (기간을 30일 초과로 늘리려면 별도 조회 필요). */
export default function ReviewPage() {
  const tasks = useStore(s => s.tasks)
  const workspaces = useStore(s => s.workspaces)
  const openDetail = useStore(s => s.openDetail)

  // completed_at(UTC ISO) → 로컬 날짜로 버킷팅 (KST 자정 경계 오류 방지)
  const doneDates = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) {
      if (t.status !== 'done' || !t.completed_at) continue
      const d = toStr(new Date(t.completed_at))
      counts.set(d, (counts.get(d) ?? 0) + 1)
    }
    return counts
  }, [tasks])

  const days = useMemo(() => {
    const out: { date: string; count: number; weekday: string }[] = []
    for (let i = 27; i >= 0; i--) {
      const d = subDays(new Date(), i)
      out.push({ date: toStr(d), count: doneDates.get(toStr(d)) ?? 0, weekday: format(d, 'EEEEE', { locale: ko }) })
    }
    return out
  }, [doneDates])
  const max = Math.max(1, ...days.map(d => d.count))
  const total28 = days.reduce((s, d) => s + d.count, 0)

  // 프로젝트(워크스페이스) 진행률 — Someday 제외, 로드된 데이터(최근 30일 완료분) 기준
  const progress = useMemo(() =>
    workspaces
      .filter(w => !w.archived)
      .map(w => {
        const list = tasks.filter(t => t.workspace_id === w.id && !t.someday)
        const done = list.filter(t => t.status === 'done').length
        return { w, done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 }
      })
      .filter(x => x.total > 0),
  [workspaces, tasks])

  // 이번 주(월~오늘) 완료 목록 — 최신 요일 먼저
  const weekGroups = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    const groups: { date: string; tasks: Task[] }[] = []
    for (let i = 0; i < 7; i++) {
      const key = toStr(addDays(start, i))
      if (key > todayStr()) break
      groups.push({ date: key, tasks: [] })
    }
    const byDate = new Map(groups.map(g => [g.date, g]))
    for (const t of tasks) {
      if (t.status !== 'done' || !t.completed_at) continue
      byDate.get(toStr(new Date(t.completed_at)))?.tasks.push(t)
    }
    for (const g of groups) g.tasks.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
    return groups.filter(g => g.tasks.length).reverse()
  }, [tasks])
  const weekTotal = weekGroups.reduce((s, g) => s + g.tasks.length, 0)

  return (
    <div className="mx-auto max-w-[760px] px-5 py-5">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-[19px] font-bold tracking-tight">Review</h1>
        <span className="text-[13.5px] font-medium text-zinc-400">최근 4주 완료 {total28}건 · 이번 주 {weekTotal}건</span>
      </div>

      {/* 최근 4주 일별 완료 막대 */}
      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 flex items-center gap-1.5 text-[14px] font-bold"><BarChart2 size={14} /> 일별 완료 (최근 4주)</h2>
        <div className="flex items-end gap-[3px]">
          {days.map(d => {
            const isToday = d.date === todayStr()
            return (
              <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${fmtDate(d.date)} — ${d.count}건`}>
                <span className="text-[10px] font-semibold text-zinc-400">{d.count || ''}</span>
                <div
                  className={`w-full rounded-t ${isToday ? 'bg-blue-500' : d.count ? 'bg-zinc-300 dark:bg-zinc-600' : 'bg-zinc-100 dark:bg-zinc-800'}`}
                  style={{ height: `${Math.max(3, (d.count / max) * 72)}px` }}
                />
                <span className={`text-[9.5px] ${isToday ? 'font-bold text-blue-500' : 'text-zinc-400'}`}>{d.weekday}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 프로젝트 진행률 */}
      {progress.length > 0 && (
        <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-[14px] font-bold">프로젝트 진행률</h2>
          <div className="space-y-2.5">
            {progress.map(({ w, done, total, pct }) => (
              <div key={w.id}>
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: wsColor(w.id, workspaces) }} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{w.name}</span>
                  <span className="text-[12px] font-semibold text-zinc-400">{done}/{total} · {pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: wsColor(w.id, workspaces) }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-zinc-400">완료 수는 최근 30일 데이터 기준입니다.</p>
        </section>
      )}

      {/* 이번 주 완료 목록 */}
      <section>
        <h2 className="mb-1.5 px-1 text-[14px] font-bold">이번 주 완료한 일</h2>
        {weekGroups.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="이번 주 완료한 태스크가 아직 없습니다" hint="완료하면 여기에 요일별로 모입니다" />
        ) : (
          weekGroups.map(g => (
            <div key={g.date} className="mb-3">
              <div className="mb-0.5 px-1.5 text-[12.5px] font-bold text-zinc-500 dark:text-zinc-400">
                {fmtDate(g.date)} <span className="font-semibold text-zinc-400">{g.tasks.length}</span>
              </div>
              {g.tasks.map(t => <TaskRow key={t.id} task={t} onOpen={openDetail} />)}
            </div>
          ))
        )}
      </section>
    </div>
  )
}
