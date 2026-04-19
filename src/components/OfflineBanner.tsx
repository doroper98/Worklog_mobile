import { Icon } from '@/components/primitives/Icon'

interface OfflineBannerProps {
  show: boolean
}

export function OfflineBanner({ show }: OfflineBannerProps) {
  if (!show) return null

  return (
    <div className="px-4 pb-2">
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs"
        style={{
          background: 'var(--color-accent-soft)',
          borderColor: 'var(--color-accent-faint)',
          color: 'var(--color-accent)',
        }}
      >
        <Icon name="cloud-off" size={14} color="var(--color-accent)" sw={2} />
        <span>오프라인 · 캐시 버전 표시 중</span>
      </div>
    </div>
  )
}
