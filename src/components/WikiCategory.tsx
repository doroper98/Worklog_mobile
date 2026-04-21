import { Icon } from '@/components/primitives/Icon'
import { LiquidGlassSurface } from '@/components/primitives/LiquidGlassSurface'
import type { TreeNode } from '@/types'

interface WikiCategoryProps {
  title: string
  files: TreeNode[]
  onFileTap: (path: string) => void
  onBack: () => void
  onTabSelect: (tab: string) => void
  onFabTap?: () => void
}

const TAB_ITEMS = [
  { key: 'home',     label: '홈',       icon: 'home' as const },
  { key: 'calendar', label: '달력',     icon: 'calendar' as const },
  { key: 'inbox',    label: '보낸 메모', icon: 'inbox' as const },
  { key: 'settings', label: '설정',     icon: 'settings' as const },
]

export function WikiCategory({ title, files, onFileTap, onBack, onTabSelect, onFabTap }: WikiCategoryProps) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden font-sans"
      style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}
    >
      {/* Header */}
      <LiquidGlassSurface
        level={1}
        className="relative z-10 flex items-center gap-3 px-4 pb-3"
        style={{ paddingTop: 'calc(16px + var(--sai-top, 0px))' }}
      >
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border-none bg-transparent"
          style={{ color: 'var(--color-accent)' }}
        >
          <Icon name="chev-left" size={20} sw={2.2} />
        </button>
        <div className="font-display text-lg font-bold tracking-tight">{title}</div>
        <div className="ml-auto font-mono text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
          {files.length}
        </div>
      </LiquidGlassSurface>

      {/* File list */}
      <div
        className="relative z-[1] flex-1 overflow-auto px-4 py-3"
        style={{ paddingBottom: 'calc(96px + var(--sai-bottom, 0px))' }}
      >
        <div
          className="overflow-hidden rounded-2xl border"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          {files.map((file, i) => {
            const name = file.path.split('/').pop()?.replace(/\.md$/, '') ?? file.path
            return (
              <button
                key={file.sha}
                onClick={() => onFileTap(file.path)}
                className="flex w-full items-center gap-2.5 border-none bg-transparent px-3.5 py-2.5 text-left"
                style={{
                  borderBottom: i < files.length - 1 ? '1px solid var(--color-hairline)' : 'none',
                  minHeight: 36,
                }}
              >
                <Icon name="file" size={14} color="var(--color-text-muted)" sw={1.8} />
                <span
                  className="flex-1 truncate text-[13.5px] font-medium tracking-tight"
                  style={{ color: 'var(--color-text)' }}
                >
                  {name}
                </span>
                <Icon name="chev-right" size={14} color="var(--color-text-faint)" sw={2} />
              </button>
            )
          })}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={onFabTap}
        className="absolute right-[22px] z-[45] flex h-14 w-14 items-center justify-center rounded-fab border-none"
        style={{
          bottom: 'calc(94px + var(--sai-bottom, 0px))',
          background: 'var(--color-accent)',
          color: 'var(--color-accent-text-on)',
          boxShadow: '0 10px 28px var(--color-accent-faint), 0 2px 8px rgba(0,0,0,0.18)',
        }}
      >
        <Icon name="pen" size={22} color="var(--color-accent-text-on)" sw={2.1} />
      </button>

      {/* Tab bar */}
      <LiquidGlassSurface
        level={2}
        className="absolute left-3.5 right-3.5 z-40 flex h-16 items-center justify-around overflow-hidden rounded-tab px-1.5"
        style={{ bottom: 'calc(14px + var(--sai-bottom, 0px))' }}
      >
        {TAB_ITEMS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabSelect(t.key)}
            className="relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 border-none bg-transparent"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Icon name={t.icon} size={22} sw={1.85} />
            <div className="text-[10px]" style={{ fontWeight: 500 }}>
              {t.label}
            </div>
          </button>
        ))}
      </LiquidGlassSurface>
    </div>
  )
}
