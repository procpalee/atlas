import { todayStr } from './dates'
import type { Task } from '../types'

/**
 * 마감·일정 브라우저 알림 (Notification API).
 * 한계: 푸시 서버가 없어 앱(설치된 PWA 포함)이 열려 있는 동안에만 동작한다.
 * 중복 방지: localStorage pd-notified = { date, ids } (날짜 바뀌면 리셋 → 하루 1회/태스크).
 */

const LS_TOGGLE = 'pd-notify'
const LS_SENT = 'pd-notified'
const ICON = '/icons/icon-192.png'

export const notifySupported = (): boolean => 'Notification' in window
export const notifyEnabled = (): boolean => localStorage.getItem(LS_TOGGLE) === '1'
export const setNotifyEnabled = (v: boolean): void => localStorage.setItem(LS_TOGGLE, v ? '1' : '0')
export const getPermission = (): NotificationPermission | 'unsupported' =>
  notifySupported() ? Notification.permission : 'unsupported'
export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notifySupported()) return 'unsupported'
  return Notification.requestPermission()
}

async function show(title: string, body: string): Promise<void> {
  // Android PWA는 new Notification()이 throw — 서비스워커 경유가 필수 폴백 순서
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) { await reg.showNotification(title, { body, icon: ICON }); return }
  } catch { /* 아래 폴백 */ }
  try { new Notification(title, { body, icon: ICON }) } catch { /* 미지원 — 무시 */ }
}

export async function sendTestNotification(): Promise<void> {
  await show('Protask 알림 테스트', '알림이 정상 동작합니다 ✓')
}

interface Sent { date: string; ids: string[] }
function loadSent(): Sent {
  try {
    const v = JSON.parse(localStorage.getItem(LS_SENT) ?? '') as Sent
    return v.date === todayStr() ? v : { date: todayStr(), ids: [] }
  } catch {
    return { date: todayStr(), ids: [] }
  }
}

/** 오늘 마감(지연 포함) + 오늘 예정 미완료 태스크를 그룹 알림. 태스크별 하루 1회. */
export async function checkAndNotify(tasks: Task[]): Promise<void> {
  if (!notifySupported() || Notification.permission !== 'granted' || !notifyEnabled()) return
  const today = todayStr()
  const sent = loadSent()
  const targets = tasks.filter(t =>
    t.status !== 'done' && !sent.ids.includes(t.id) && ((t.deadline && t.deadline <= today) || t.scheduled_date === today),
  )
  if (!targets.length) return

  const list = (arr: Task[]) =>
    arr.slice(0, 5).map(t => `• ${t.title}`).join('\n') + (arr.length > 5 ? `\n외 ${arr.length - 5}건` : '')
  const deadlines = targets.filter(t => t.deadline && t.deadline <= today)
  const scheduled = targets.filter(t => !(t.deadline && t.deadline <= today))
  if (deadlines.length) await show(`마감 ${deadlines.length}건`, list(deadlines))
  if (scheduled.length) await show(`오늘 할 일 ${scheduled.length}건`, list(scheduled))

  sent.ids.push(...targets.map(t => t.id))
  localStorage.setItem(LS_SENT, JSON.stringify(sent))
}
