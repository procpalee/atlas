import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, selDated, useNavOrder, visibleDone } from '../store/store'
import { useGcal } from '../store/gcalStore'
import { todayStr, toStr, fmtDateShort, thisWeekEnd, nextWeekStart, nextWeekEnd } from '../lib/dates'
import { addDays } from 'date-fns'
import TaskRow from '../components/TaskRow'
import DoneSection from '../components/DoneSection'
import EmptyState from '../components/EmptyState'
import FilterBar, { useTaskFilter } from '../components/FilterBar'
import { AlarmClockOff, CalendarClock, CalendarDays } from 'lucide-react'
import type { Task } from '../types'
import type { GcalEvent } from '../lib/gcal'

const RANGE_DAYS = 60

type BucketKey = 'overdue' | 'today' | 'tomorrow' | 'thisweek' | 'nextweek' | 'later'
const BUCKETS: { key: BucketKey; label: string }[] = [
  { key: 'overdue', label: '지연' },
  { key: 'today', label: '오늘' },
  { key: 'tomorrow', label: '내일' },
  { key: 'thisweek', label: '이번 주' },
  { key: 'nextweek', label: '다음 주' },
  { key: 'later', label: '이후' },
]

/** 날짜 문자열 → Upcoming 버킷. 경계는 월요일 시작 주(lib/dates) 기준 */
function bucketOfDate(date: string, today: string, tomorrow: string, twEnd: string, nwStart: string, nwEnd: string): BucketKey {
  if (date < today) return 'overdue'
  if (date === today) return 'today'
  if (date === tomorrow) return 'tomorrow'
  if (date <= twEnd) return 'thisweek'
  if (date >= nwStart && date <= nwEnd) return 'nextweek'
  return 'later'
}

export default function UpcomingPage() {
  const filter = useTaskFilter('pd-filter-upcoming')
  const datedAll = useStore(useShallow(selDated))
  const dated = useMemo(() => datedAll.filter(filter.pass), [datedAll, filter.f]) // eslint-disable-line react-hooks/exhaustive-deps
  const doneDated = useStore(useShallow((s: Parameters<typeof selDated>[0]) =>
    s.tasks.filter(t => t.status === 'done' && t.scheduled_date && visibleDone(t))
      .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
  ))
  const updateTask = useStore(s => s.updateTask)
  const openDetail = useStore(s => s.openDetail)
  const gcal = useGcal()

  useEffect(() => {
    void gcal.init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (gcal.status === 'connected')
      void gcal.ensureRange(todayStr(), toStr(addDays(new Date(), RANGE_DAYS)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gcal.status])

  const { byBucket, overdueTasks } = useMemo(() => {
    const today = todayStr()
    const tomorrow = toStr(addDays(new Date(), 1))
    const twEnd = thisWeekEnd()
    const nwStart = nextWeekStart()
    const nwEnd = nextWeekEnd()
    const map: Record<BucketKey, { tasks: Task[]; events: GcalEvent[] }> =
      { overdue: { tasks: [], events: [] }, today: { tasks: [], events: [] }, tomorrow: { tasks: [], events: [] }, thisweek: { tasks: [], events: [] }, nextweek: { tasks: [], events: [] }, later: { tasks: [], events: [] } }
    for (const t of dated) map[bucketOfDate(t.scheduled_date!, today, tomorrow, twEnd, nwStart, nwEnd)].tasks.push(t)
    if (gcal.status === 'connected') {
      const max = toStr(addDays(new Date(), RANGE_DAYS))
      for (const e of gcal.events) {
        if (e.date >= today && e.date <= max && (gcal.selected === null || gcal.selected.includes(e.calendarId)))
          map[bucketOfDate(e.date, today, tomorrow, twEnd, nwStart, nwEnd)].events.push(e)
      }
      for (const k of Object.keys(map) as BucketKey[]) map[k].events.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    }
    return { byBucket: map, overdueTasks: map.overdue.tasks }
  }, [dated, gcal.events, gcal.status, gcal.selected])

  useNavOrder(useMemo(() => BUCKETS.flatMap(b => byBucket[b.key].tasks.map(t => t.id)), [byBucket]))

  const total = dated.filter(t => t.scheduled_date! >= todayStr()).length

  return (
    <div className="mx-auto max-w-[760px] px-5 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[19px] font-bold tracking-tight">Upcoming</h1>
        <span className="text-[13.5px] font-medium text-zinc-400">예정 {total}건{overdueTasks.length ? ` · 지연 ${overdueTasks.length}` : ''}</span>
        <FilterBar filter={filter} />
      </div>

      {BUCKETS.map(b => {
        const { tasks, events } = byBucket[b.key]
        if (!tasks.length && !events.length) return null
        const isOverdue = b.key === 'overdue'
        return (
          <section key={b.key} className="mb-5">
            <div className="mb-1 flex items-center gap-1.5 px-1">
              {isOverdue && <AlarmClockOff size={13} className="text-red-500" />}
              <span className={`text-[13px] font-bold ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}>{b.label}</span>
              <span className="text-[12.5px] font-semibold text-zinc-400">{tasks.length || ''}</span>
              {isOverdue && (
                <button
                  className="ml-auto rounded px-1.5 py-0.5 text-[12.5px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  onClick={() => tasks.forEach(t => updateTask(t.id, { scheduled_date: todayStr() }))}
                >
                  모두 오늘로 이동
                </button>
              )}
            </div>
            {events.map(ev => (
              <div key={ev.id} className="flex min-h-[30px] items-center gap-2.5 rounded-md px-2 py-1">
                <CalendarDays size={13} className="shrink-0 text-zinc-300 dark:text-zinc-600" />
                <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: ev.color ?? '#3b82f6' }} />
                <span className="w-[96px] shrink-0 text-[12.5px] font-semibold text-zinc-400">
                  {fmtDateShort(ev.date)} {ev.allDay ? '종일' : ev.start.slice(11, 16)}
                </span>
                <span className="truncate text-[13.5px] text-zinc-500 dark:text-zinc-400">{ev.summary}</span>
              </div>
            ))}
            {tasks.map(t => <TaskRow key={t.id} task={t} onOpen={openDetail} />)}
          </section>
        )
      })}

      {dated.length === 0 && (
        <EmptyState icon={CalendarClock} title="예정된 태스크가 없습니다" hint="태스크에 실행일을 지정하면 여기에 나타납니다" />
      )}

      <DoneSection tasks={doneDated} storageKey="pd-upcoming-done" className="mt-6" />
    </div>
  )
}
