/** 초기 로딩 스켈레톤 — 리스트 화면 형태 유지 (App의 fetchAll 대기 중) */
export default function Skeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-1.5 px-6 py-8">
      <div className="mb-5 h-6 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <div className="h-[17px] w-[17px] shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 rounded bg-zinc-200 dark:bg-zinc-800" style={{ width: `${45 + ((i * 17) % 40)}%` }} />
        </div>
      ))}
    </div>
  )
}
