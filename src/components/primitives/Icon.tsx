/**
 * SVG stroke icon set — extracted from WW26Theme.jsx.
 * Lucide-style, 24x24 viewBox, configurable size/color/strokeWidth.
 */

interface IconProps {
  name: IconName
  size?: number
  color?: string
  sw?: number
  className?: string
}

export type IconName =
  | 'search' | 'inbox' | 'settings' | 'users' | 'folder' | 'alert'
  | 'file' | 'cloud-off' | 'plus' | 'chevron' | 'home' | 'check'
  | 'mic' | 'pen' | 'calendar' | 'camera' | 'bell' | 'chev-right'
  | 'chev-left' | 'copy' | 'sparkles' | 'arrow-up' | 'dots'
  | 'arrow-right' | 'x'

export function Icon({ name, size = 20, color = 'currentColor', sw = 1.85, className }: IconProps) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }

  switch (name) {
    case 'search':
      return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    case 'inbox':
      return <svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-6z" /></svg>
    case 'settings':
      return <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
    case 'users':
      return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
    case 'folder':
      return <svg {...p}><path d="M4 4h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /></svg>
    case 'alert':
      return <svg {...p}><path d="m12 3 10 18H2L12 3z" /><path d="M12 10v4" /><circle cx="12" cy="17" r=".5" fill={color} /></svg>
    case 'file':
      return <svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
    case 'cloud-off':
      return <svg {...p}><path d="M9 9a5 5 0 0 1 10 1c2 0 4 1.5 4 4 0 1.3-.6 2.4-1.5 3.2" /><path d="M2 2l20 20" /><path d="M15 17H5a4 4 0 0 1-1-7.9" /></svg>
    case 'plus':
      return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>
    case 'chevron':
      return <svg {...p}><path d="m9 18 6-6-6-6" /></svg>
    case 'home':
      return <svg {...p}><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" /></svg>
    case 'check':
      return <svg {...p}><path d="m4 12 5 5L20 6" /></svg>
    case 'mic':
      return <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 19v3" /></svg>
    case 'pen':
      return <svg {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z" /></svg>
    case 'calendar':
      return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
    case 'camera':
      return <svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
    case 'bell':
      return <svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
    case 'chev-right':
      return <svg {...p}><path d="m9 18 6-6-6-6" /></svg>
    case 'chev-left':
      return <svg {...p}><path d="m15 18-6-6 6-6" /></svg>
    case 'copy':
      return <svg {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
    case 'sparkles':
      return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></svg>
    case 'arrow-up':
      return <svg {...p}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    case 'dots':
      return <svg {...p}><circle cx="5" cy="12" r="1.5" fill={color} /><circle cx="12" cy="12" r="1.5" fill={color} /><circle cx="19" cy="12" r="1.5" fill={color} /></svg>
    case 'arrow-right':
      return <svg {...p}><path d="M5 12h14M13 5l7 7-7 7" /></svg>
    case 'x':
      return <svg {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
    default:
      return null
  }
}
