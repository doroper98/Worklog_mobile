import { Icon } from '@/components/primitives/Icon'

interface UpdateBannerProps {
  show: boolean
  applying: boolean
  onApply: () => void
}

/** Shown on Home when a new build is installed and waiting. Mirrors OfflineBanner. */
export function UpdateBanner({ show, applying, onApply }: UpdateBannerProps) {
  if (!show) return null

  return (
    <div className="px-4 pb-2">
      <button
        type="button"
        onClick={onApply}
        disabled={applying}
        className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs"
        style={{
          background: 'var(--color-accent-soft)',
          borderColor: 'var(--color-accent-faint)',
          color: 'var(--color-accent)',
        }}
      >
        <Icon name="arrow-up" size={14} color="var(--color-accent)" sw={2} />
        <span className="flex-1">
          {applying ? '업데이트 중…' : '새 버전이 준비됐습니다'}
        </span>
        {!applying && <span className="font-medium">업데이트</span>}
      </button>
    </div>
  )
}
