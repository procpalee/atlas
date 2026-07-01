import { Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Inbox, Sun, CalendarClock, Settings as SettingsIcon, Plus, Menu, Moon, SunMedium, X } from 'lucide-react'
import Sidebar, { useTheme, MobileDrawer, SyncDot } from './components/Sidebar'
import QuickCapture from './components/QuickCapture'
import Shortcuts from './components/Shortcuts'
import TaskDetail from './components/TaskDetail'
import DialogHost from './components/DialogHost'
import SyncBanner from './components/SyncBanner'
import Skeleton from './components/Skeleton'
import SearchPalette from './components/SearchPalette'
import BulkBar from './components/BulkBar'
import TodayPage from './pages/Today'
import WeekPage from './pages/Week'
import InboxPage from './pages/Inbox'
import UpcomingPage from './pages/Upcoming'
import CalendarPage from './pages/Calendar'
import WorkspacePage from './pages/Workspace'
import SettingsPage from './pages/Settings'
import GuidePage from './pages/Guide'
import WorkspaceListPage from './pages/WorkspaceList'
import Login from './components/Login'
import { useStore, selOverdue } from './store/store'
import { useAuth, REQUIRE_AUTH } from './store/authStore'
import { useSplit, type RightView } from './store/splitStore'

export default function App() {
  const { dark, toggle } = useTheme()
  const fetchAll = useStore(s => s.fetchAll)
  const loaded = useStore(s => s.loaded)
  const detailTaskId = useStore(s => s.detailTaskId)
  const openDetail = useStore(s => s.openDetail)
  const session = useAuth(s => s.session)
  const authReady = useAuth(s => s.ready)
  const hiddenAt = useRef<number | null>(null)
  const authed = !REQUIRE_AUTH || !!session
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!authed) return // 로그인 전에는 데이터를 불러오지 않음(RLS로 어차피 거부됨)
    void fetchAll()
  }, [fetchAll, authed])

  // 5분 이상 hidden 후 복귀 시 refetch (outbox 비어있을 때만 — store에서 가드)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else if (hiddenAt.current && Date.now() - hiddenAt.current > 5 * 60_000) {
        hiddenAt.current = null
        void fetchAll()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [fetchAll])

  if (REQUIRE_AUTH && !authReady) {
    return <div className="flex h-full items-center justify-center text-[14px] text-zinc-400">불러오는 중…</div>
  }
  if (REQUIRE_AUTH && !session) {
    return <Login />
  }

  return (
    <BrowserRouter>
      <MobileTopBar onMenu={() => setDrawerOpen(true)} dark={dark} onToggleTheme={toggle} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} dark={dark} onToggleTheme={toggle} />
      <div className="flex h-full">
        <Sidebar dark={dark} onToggleTheme={toggle} />
        <main className="min-w-0 flex-1 overflow-hidden pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0">
          {!loaded ? (
            <Skeleton />
          ) : (
            <Suspense fallback={<Skeleton />}>
              <SplitLayout>
                <Routes>
                  <Route path="/" element={<TodayPage />} />
                  <Route path="/inbox" element={<InboxPage />} />
                  <Route path="/upcoming" element={<UpcomingPage />} />
                  <Route path="/week" element={<WeekPage />} />
                  <Route path="/scheduled" element={<Navigate to="/upcoming" replace />} />
                  <Route path="/someday" element={<Navigate to="/inbox" replace />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/workspaces" element={<WorkspaceListPage />} />
                  <Route path="/w/:wsId" element={<WorkspacePage />} />
                  <Route path="/w/:wsId/p/:projectId" element={<SubprojectRedirect />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/guide" element={<GuidePage />} />
                </Routes>
              </SplitLayout>
            </Suspense>
          )}
        </main>
      </div>
      <MobileNav />
      <CaptureFab />
      <QuickCapture />
      <Shortcuts />
      <Flash />
      <SyncBanner />
      <SearchPalette />
      <BulkBar />
      {/* 상세 — 중앙 팝업 */}
      {detailTaskId && <TaskDetail key={detailTaskId} taskId={detailTaskId} onClose={() => openDetail(null)} />}
      <DialogHost />
    </BrowserRouter>
  )
}

const RIGHT_VIEWS: Record<RightView, { label: string; comp: React.ComponentType }> = {
  today: { label: 'Today', comp: TodayPage },
  inbox: { label: 'Inbox', comp: InboxPage },
  upcoming: { label: 'Upcoming', comp: UpcomingPage },
  week: { label: 'This Week', comp: WeekPage },
  calendar: { label: 'Calendar', comp: CalendarPage },
}

/** md 이상(데스크탑) 여부 — 분할은 데스크탑에서만 */
function useIsDesktop() {
  const [d, setD] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 768px)')
    const h = () => setD(m.matches)
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  return d
}

/** 메인 영역을 좌/우 2분할. 왼쪽=현재 라우트, 오른쪽=선택한 뷰. 경계 드래그로 폭 조절. */
function SplitLayout({ children }: { children: React.ReactNode }) {
  const on = useSplit(s => s.on)
  const rightView = useSplit(s => s.rightView)
  const ratio = useSplit(s => s.ratio)
  const setRatio = useSplit(s => s.setRatio)
  const setRightView = useSplit(s => s.setRightView)
  const toggle = useSplit(s => s.toggle)
  const isDesktop = useIsDesktop()
  const ref = useRef<HTMLDivElement>(null)

  if (!on || !isDesktop) return <div className="h-full overflow-y-auto">{children}</div>

  const RightComp = RIGHT_VIEWS[rightView].comp
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const move = (ev: PointerEvent) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setRatio((ev.clientX - r.left) / r.width)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div ref={ref} className="flex h-full">
      <div className="h-full overflow-y-auto" style={{ width: `${ratio * 100}%` }}>{children}</div>
      <div
        onPointerDown={startDrag}
        title="드래그하여 크기 조절"
        className="w-1.5 shrink-0 cursor-col-resize bg-zinc-200 transition-colors hover:bg-blue-400 dark:bg-zinc-800 dark:hover:bg-blue-500"
      />
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
          <span className="text-[12px] font-semibold text-zinc-400">분할 뷰</span>
          <select
            value={rightView}
            onChange={e => setRightView(e.target.value as RightView)}
            className="rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-[13px] font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 dark:[&>option]:bg-zinc-900"
          >
            {(Object.keys(RIGHT_VIEWS) as RightView[]).map(k => <option key={k} value={k}>{RIGHT_VIEWS[k].label}</option>)}
          </select>
          <button onClick={toggle} title="분할 닫기" className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RightComp />
        </div>
      </div>
    </div>
  )
}

/** 하단 일시 알림 (pd:flash 이벤트) */
function Flash() {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const onFlash = (e: Event) => {
      setMsg(String((e as CustomEvent).detail))
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setMsg(null), 2200)
    }
    window.addEventListener('pd:flash', onFlash)
    return () => window.removeEventListener('pd:flash', onFlash)
  }, [])
  if (!msg) return null
  return (
    <div className="fixed bottom-16 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-1.5 text-[13.5px] font-medium text-white shadow-lg md:bottom-6 dark:bg-zinc-100 dark:text-zinc-900">
      {msg}
    </div>
  )
}

const STATIC_TITLES: Record<string, string> = {
  '/': 'Today', '/inbox': 'Inbox', '/upcoming': 'Upcoming', '/someday': 'Someday',
  '/calendar': 'Calendar', '/week': 'This Week', '/workspaces': '프로젝트', '/settings': '설정', '/guide': '설명서',
}

/** 구 서브프로젝트 URL(/w/:wsId/p/:projectId) → 프로젝트 뷰로 리다이렉트 */
function SubprojectRedirect() {
  const { wsId } = useParams<{ wsId: string }>()
  return <Navigate to={`/w/${wsId}`} replace />
}

/** 모바일 상단 바 — 햄버거(드로어) + 현재 화면 타이틀 + 테마 토글 + 동기화 점 */
function MobileTopBar({ onMenu, dark, onToggleTheme }: { onMenu: () => void; dark: boolean; onToggleTheme: () => void }) {
  const loc = useLocation()
  const workspaces = useStore(s => s.workspaces)

  let title = STATIC_TITLES[loc.pathname]
  if (!title) {
    // /w/:wsId — 프로젝트(구 워크스페이스) 이름으로
    const seg = loc.pathname.split('/').filter(Boolean) // ['w', wsId]
    if (seg[0] === 'w') title = workspaces.find(w => w.id === seg[1])?.name || 'Protask'
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-zinc-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="flex h-12 items-center gap-1.5 px-2">
        <button onClick={onMenu} aria-label="메뉴" className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
          <Menu size={20} />
        </button>
        <span className="truncate text-[15px] font-semibold tracking-tight">{title ?? 'Protask'}</span>
        <button
          onClick={onToggleTheme}
          aria-label="테마 전환"
          className="ml-auto rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {dark ? <SunMedium size={18} /> : <Moon size={18} />}
        </button>
        <SyncDot className="mr-1 shrink-0" />
      </div>
    </header>
  )
}

/** 모바일 빠른 캡처 FAB — 어느 화면에서나 전역 캡처를 연다(하단 탭 위에 띄움) */
function CaptureFab() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('pd:capture-open'))}
      aria-label="빠른 캡처"
      className="fixed right-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.875rem)] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform active:scale-95 md:hidden dark:bg-blue-600"
    >
      <Plus size={26} strokeWidth={2.4} />
    </button>
  )
}

function MobileNav() {
  const overdueCount = useStore(s => selOverdue(s).length)
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'
    }`
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
      <NavLink to="/inbox" className={cls}><Inbox size={18} />Inbox</NavLink>
      <NavLink to="/" end className={cls}>
        <span className="relative">
          <Sun size={18} />
          {overdueCount > 0 && (
            <span className="absolute -top-1 -right-2.5 rounded-full bg-red-500 px-1 py-px text-[9.5px] font-semibold leading-tight text-white">
              {overdueCount}
            </span>
          )}
        </span>
        Today
      </NavLink>
      <NavLink to="/upcoming" className={cls}><CalendarClock size={18} />Upcoming</NavLink>
      <NavLink to="/settings" className={cls}><SettingsIcon size={18} />설정</NavLink>
    </nav>
  )
}
