import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { lastSyncError, onSyncStatus, pendingCount, retryNow, type SyncStatus } from '../lib/sync'

/**
 * 동기화 문제 가시화 (SyncDot 보완).
 *  - 오프라인: 상단 얇은 배너 — 변경은 저장되며 복귀 시 자동 동기화됨을 안내.
 *  - 저장 실패(error): 하단 고정 토스트 + 재시도 버튼. idle로 돌아올 때까지 유지(Flash와 달리 자동소멸 없음).
 */
export default function SyncBanner() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [pending, setPending] = useState(() => pendingCount())
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => onSyncStatus((s, p) => { setStatus(s); setPending(p) }), [])
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const offline = !online || status === 'offline'
  const err = lastSyncError?.error as { status?: number; code?: string } | null | undefined
  const authExpired = err?.status === 401 || err?.code === 'PGRST301'

  return (
    <>
      {offline && (
        <div className="fixed inset-x-0 top-[calc(3rem+env(safe-area-inset-top))] z-[60] flex items-center justify-center gap-1.5 bg-amber-500/95 py-1 text-[12.5px] font-medium text-white md:top-0 dark:bg-amber-600/95">
          <WifiOff size={13} />
          오프라인 — 변경사항은 저장되며 연결 복귀 시 자동 동기화됩니다
        </div>
      )}
      {!offline && status === 'error' && (
        <div className="fixed bottom-16 left-1/2 z-[65] flex -translate-x-1/2 items-center gap-2 rounded-full border border-red-200 bg-white py-1.5 pr-1.5 pl-4 text-[13px] font-medium text-red-600 shadow-lg md:bottom-6 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400">
          <span>
            저장 실패 — {pending}건 대기 중{authExpired && ' · 다시 로그인이 필요합니다'}
          </span>
          <button
            onClick={() => retryNow()}
            className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw size={12} />
            재시도
          </button>
        </div>
      )}
    </>
  )
}
