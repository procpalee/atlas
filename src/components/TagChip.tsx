import { tagColor } from '../types'

/** 태그 칩 — 색은 태그명 해시로 파생(저장 없음). onRemove가 있으면 × 버튼 노출 */
export default function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const c = tagColor(tag)
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[11.5px] font-semibold"
      style={{ background: `${c}1f`, color: c }}
    >
      #{tag}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove() }} className="ml-0.5 opacity-50 hover:opacity-100" title="태그 제거">
          ×
        </button>
      )}
    </span>
  )
}
