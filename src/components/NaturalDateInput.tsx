import { useState } from 'react'
import { fmtDate, parseQuick } from '../lib/dates'

/** 자연어 날짜 입력 — parseQuick 재사용("내일", "다음주 금", "3월 15일"…). Enter로 확정. */
export default function NaturalDateInput({ onDate, placeholder = '내일 · 다음주 금 · 3월 15일…', autoFocus }: {
  onDate: (date: string) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [v, setV] = useState('')
  const parsed = v.trim() ? parseQuick(v).date : null
  const invalid = v.trim().length > 0 && !parsed

  return (
    <div className="min-w-0">
      <input
        className={`w-full rounded-md border bg-transparent px-2 py-1 text-[12.5px] outline-none placeholder:text-zinc-400 ${
          invalid
            ? 'border-red-300 dark:border-red-800'
            : 'border-zinc-200 focus:border-blue-400 dark:border-zinc-700 dark:focus:border-blue-500'
        }`}
        value={v}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            if (parsed) { onDate(parsed); setV('') }
          }
        }}
      />
      {parsed && <div className="mt-0.5 px-0.5 text-[11.5px] font-medium text-blue-500">→ {fmtDate(parsed)} (Enter)</div>}
    </div>
  )
}
