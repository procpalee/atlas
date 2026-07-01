import { addDays, addMonths, addWeeks, endOfWeek, format, parseISO, startOfWeek, differenceInCalendarDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Recurrence } from '../types'

/* 주 경계(월요일 시작) — Plan 팝업·Upcoming 공용 */
export function thisWeekEnd(): string { return toStr(endOfWeek(new Date(), { weekStartsOn: 1 })) }
export function nextWeekStart(): string { return toStr(startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 })) }
export function nextWeekEnd(): string { return toStr(endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 })) }

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function toStr(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function fmtDate(s: string): string {
  return format(parseISO(s), 'M월 d일 (EEE)', { locale: ko })
}

export function fmtDateShort(s: string): string {
  return format(parseISO(s), 'M/d', { locale: ko })
}

/** 오늘 기준 일수 차 (음수 = 과거) */
export function daysFromToday(s: string): number {
  return differenceInCalendarDays(parseISO(s), new Date())
}

export function nextOccurrence(dateStr: string, rec: Recurrence): string {
  const d = parseISO(dateStr)
  const n = rec.interval || 1
  if (rec.freq === 'daily') return toStr(addDays(d, n))
  if (rec.freq === 'weekly') return toStr(addWeeks(d, n))
  return toStr(addMonths(d, n))
}

const WEEKDAYS: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }

/**
 * 빠른 캡처용 한국어 날짜·태그 파싱.
 * "보고서 작성 내일 #업무" → { title:"보고서 작성", date:내일, tags:['업무'] }
 * 날짜: 오늘/내일/모레/다음주/이번주/X요일/다음주 X요일/M월 D일/M/D · 태그: #없는공백단어
 */
export function parseQuick(input: string): { title: string; date: string | null; tags: string[] } {
  let text = input.trim()
  let date: string | null = null
  const today = new Date()

  // #태그 추출 (제목에서 제거)
  const tags: string[] = []
  text = text.replace(/(?:^|\s)#([^\s#]+)/g, (_, tag: string) => {
    if (!tags.includes(tag)) tags.push(tag)
    return ' '
  }).replace(/\s{2,}/g, ' ').trim()

  const apply = (re: RegExp, fn: (m: RegExpMatchArray) => Date | null) => {
    if (date) return
    const m = text.match(re)
    if (!m) return
    const d = fn(m)
    if (!d) return
    date = toStr(d)
    text = (text.slice(0, m.index) + text.slice((m.index ?? 0) + m[0].length)).replace(/\s{2,}/g, ' ').trim()
  }

  apply(/(?:^|\s)모레(?=\s|$)/, () => addDays(today, 2))
  apply(/(?:^|\s)내일(?=\s|$)/, () => addDays(today, 1))
  apply(/(?:^|\s)오늘(?=\s|$)/, () => today)
  apply(/(?:^|\s)다음\s?주\s?([월화수목금토일])(?:요일)?(?=\s|$)/, m => {
    const target = WEEKDAYS[m[1]]
    const base = addWeeks(today, 1)
    const diff = (target - base.getDay() + 7) % 7
    return addDays(base, diff)
  })
  apply(/(?:^|\s)다음\s?주(?=\s|$)/, () => addWeeks(today, 1))
  apply(/(?:^|\s)([월화수목금토일])요일(?=\s|$)/, m => {
    const target = WEEKDAYS[m[1]]
    let diff = (target - today.getDay() + 7) % 7
    if (diff === 0) diff = 7
    return addDays(today, diff)
  })
  apply(/(?:^|\s)(\d{1,2})월\s?(\d{1,2})일(?=\s|$)/, m => {
    const d = new Date(today.getFullYear(), Number(m[1]) - 1, Number(m[2]))
    return d < today ? new Date(today.getFullYear() + 1, Number(m[1]) - 1, Number(m[2])) : d
  })
  apply(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/, m => {
    const d = new Date(today.getFullYear(), Number(m[1]) - 1, Number(m[2]))
    return d < today ? new Date(today.getFullYear() + 1, Number(m[1]) - 1, Number(m[2])) : d
  })

  return { title: text, date, tags }
}
