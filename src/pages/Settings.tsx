import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, CalendarCheck2, Unplug, LogOut, RefreshCw, Tags, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { gcalEnabled } from '../lib/gcal'
import { useGcal } from '../store/gcalStore'
import { useAuth, REQUIRE_AUTH } from '../store/authStore'
import { useStore, beginBatch, endBatch } from '../store/store'
import { promptDialog, confirmDialog } from '../store/dialogStore'
import TagChip from '../components/TagChip'

export default function SettingsPage() {
  const [exporting, setExporting] = useState(false)
  const gcal = useGcal()
  const session = useAuth(s => s.session)
  const signOut = useAuth(s => s.signOut)

  useEffect(() => {
    void gcal.init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const exportJson = async () => {
    setExporting(true)
    try {
      const [ws, ph, pr, tk, cv, sc] = await Promise.all([
        supabase.from('workspaces').select('*'),
        supabase.from('phases').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('workspace_canvas').select('*'),
        supabase.from('today_sections').select('*'),
      ])
      const blob = new Blob(
        [JSON.stringify({
          exported_at: new Date().toISOString(),
          workspaces: ws.data, phases: ph.data, projects: pr.data, tasks: tk.data, workspace_canvas: cv.data, today_sections: sc.data,
        }, null, 2)],
        { type: 'application/json' },
      )
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } finally {
      setExporting(false)
    }
  }

  const isChecked = (id: string) => gcal.selected === null || gcal.selected.includes(id)
  const toggleCal = (id: string) => {
    const all = gcal.calendars.map(c => c.id)
    const cur = gcal.selected === null ? all : gcal.selected
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    gcal.setSelected(next.length === all.length ? null : next)
  }

  return (
    <div className="mx-auto max-w-[680px] px-5 py-5">
      <h1 className="mb-5 text-[19px] font-bold tracking-tight">설정</h1>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 flex items-center gap-1.5 text-[14.5px] font-bold"><Download size={14} /> 백업</h2>
        <p className="mb-3 text-[13.5px] text-zinc-400">전체 데이터(프로젝트·서브프로젝트·태스크·캔버스·섹션)를 JSON 파일로 내보냅니다. 주기적으로 받아두세요.</p>
        <button className="btn btn-primary" onClick={() => void exportJson()} disabled={exporting}>
          {exporting ? '내보내는 중…' : 'JSON 내보내기'}
        </button>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-1 flex items-center gap-1.5 text-[14.5px] font-bold"><CalendarCheck2 size={14} /> 구글캘린더</h2>
        {!gcalEnabled ? (
          <p className="text-[13.5px] text-zinc-400">
            연동하려면 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">VITE_GOOGLE_CLIENT_ID</code> 환경변수가 필요합니다. 자세한 절차는{' '}
            <Link to="/guide" className="text-blue-600 underline dark:text-blue-400">사용 설명서</Link>를 참고하세요.
          </p>
        ) : gcal.status === 'connected' ? (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <p className="text-[13.5px] font-medium text-emerald-600 dark:text-emerald-400">연결됨</p>
              <button className="btn" onClick={() => void gcal.connect()} title="쓰기 권한 재동의 — 일정 추가·수정·삭제가 안 되면 눌러주세요">
                <RefreshCw size={13} /> 재연결(쓰기 권한)
              </button>
              <button className="btn" onClick={() => gcal.disconnect()}>
                <Unplug size={13} /> 연결 해제
              </button>
            </div>
            <p className="mb-3 text-[12.5px] text-zinc-400">일정 추가·수정·삭제가 안 되면 “재연결(쓰기 권한)”으로 한 번 재동의하세요.</p>
            <h3 className="mb-1.5 text-[13px] font-bold text-zinc-500 dark:text-zinc-400">표시할 캘린더</h3>
            <div className="space-y-1">
              {gcal.calendars.map(c => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-blue-600"
                    checked={isChecked(c.id)}
                    onChange={() => toggleCal(c.id)}
                  />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: c.color ?? '#3b82f6' }} />
                  <span className="text-[13.5px]">{c.summary}</span>
                  {c.primary && <span className="text-[11.5px] font-semibold text-zinc-400">기본</span>}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => void gcal.connect()}>연결</button>
        )}
      </section>

      <TagManageSection />

      {REQUIRE_AUTH && session && (
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-1 flex items-center gap-1.5 text-[14.5px] font-bold"><LogOut size={14} /> 계정</h2>
          <p className="mb-3 text-[13.5px] text-zinc-400">{session.user.email ?? '로그인됨'}</p>
          <button className="btn" onClick={() => void signOut()}>
            <LogOut size={13} /> 로그아웃
          </button>
        </section>
      )}

      <p className="mt-6 text-center text-[13.5px] text-zinc-400">
        사용법·단축키·GTD 개념은 <Link to="/guide" className="text-blue-600 underline dark:text-blue-400">사용 설명서</Link>에서 확인하세요.
      </p>
    </div>
  )
}

/** 태그 관리 — 사용 중 태그 목록(개수) + 이름 변경·삭제(전 태스크 일괄, Ctrl+Z 복원) */
function TagManageSection() {
  const tasks = useStore(s => s.tasks)
  const updateTask = useStore(s => s.updateTask)

  const counts = new Map<string, number>()
  for (const t of tasks) for (const tag of t.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  const tags = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'ko'))

  const renameTag = async (tag: string) => {
    const v = await promptDialog({ title: `#${tag} 이름 변경`, defaultValue: tag, confirmLabel: '변경' })
    const next = v?.replace(/^#/, '').replace(/\s+/g, '').trim()
    if (!next || next === tag) return
    beginBatch()
    for (const t of tasks) {
      if (!(t.tags ?? []).includes(tag)) continue
      updateTask(t.id, { tags: [...new Set(t.tags.map(x => (x === tag ? next : x)))] })
    }
    endBatch(`태그 이름 변경 (#${tag} → #${next})`)
  }
  const deleteTag = async (tag: string) => {
    if (!(await confirmDialog({ title: '태그 삭제', message: `#${tag} 태그를 모든 태스크(${counts.get(tag)}개)에서 제거할까요?`, confirmLabel: '삭제', danger: true }))) return
    beginBatch()
    for (const t of tasks) {
      if (!(t.tags ?? []).includes(tag)) continue
      updateTask(t.id, { tags: t.tags.filter(x => x !== tag) })
    }
    endBatch(`태그 삭제 (#${tag})`)
  }

  return (
    <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-1 flex items-center gap-1.5 text-[14.5px] font-bold"><Tags size={14} /> 태그</h2>
      <p className="mb-3 text-[13.5px] text-zinc-400">
        태스크에 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">#태그</code>로 붙이는 자유 분류입니다.
        이름 변경·삭제는 최근 30일 데이터 기준으로 일괄 반영됩니다 (Ctrl+Z 복원 가능).
      </p>
      {tags.length === 0 ? (
        <p className="text-[13.5px] text-zinc-400">아직 태그가 없습니다 — 빠른 캡처에서 "보고서 #업무 내일"처럼 입력해 보세요.</p>
      ) : (
        <div className="space-y-0.5">
          {tags.map(tag => (
            <div key={tag} className="group flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <TagChip tag={tag} />
              <span className="text-[12px] font-semibold text-zinc-400">{counts.get(tag)}</span>
              <span className="ml-auto invisible flex items-center gap-0.5 group-hover:visible">
                <button className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" title="이름 변경" onClick={() => void renameTag(tag)}>
                  <Pencil size={13} />
                </button>
                <button className="rounded p-1 text-zinc-400 hover:text-red-600" title="삭제" onClick={() => void deleteTag(tag)}>
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
