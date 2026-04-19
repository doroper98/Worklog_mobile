// WW26Theme.jsx — Liquid Glass theme system with 3 palettes:
//   light = v1 original light (neutral cream)
//   dark  = v1 Tokyo Night
//   ant   = Ant Design 5 palette + Liquid Glass
// All themes share the same Liquid Glass chrome (blur, highlight, shadow).

const WW26_COLORS = {
  // ── v1 Light (preserved) ───────────────────────────────────────────────
  light: {
    bg:          '#F4F3EF',
    bg2:         '#EDEBE5',
    surface:     '#FFFFFF',
    surfaceAlt:  '#FAF9F6',
    surfaceWarm: '#F2EFE8',

    border:       'rgba(26,27,38,0.08)',
    borderStrong: 'rgba(26,27,38,0.14)',
    hairline:     'rgba(26,27,38,0.05)',

    text:     '#1A1B26',
    textSec:  '#4B4D60',
    textMuted:'#8A8D9F',
    textFaint:'#B8BAC7',

    accent:       '#3D5AFE',
    accentHover:  '#2F48D8',
    accentSoft:   'rgba(61,90,254,0.08)',
    accentFaint:  'rgba(61,90,254,0.14)',
    accentTextOn: '#FFFFFF',

    meet:     '#C2456F',
    task:     '#3D5AFE',
    memo:     '#B07A1F',
    personal: '#7A4FB5',
    daily:    '#2E7D57',

    danger:   '#D13E4C',
    success:  '#2E7D57',
    warning:  '#B07A1F',

    skel:  'rgba(26,27,38,0.07)',
    skel2: 'rgba(26,27,38,0.03)',

    glassBg:      'rgba(255,255,255,0.72)',
    glassBgSheet: 'rgba(255,255,255,0.85)',
    glassHighlight: 'rgba(255,255,255,0.9)',
    glassBorder:  'rgba(26,27,38,0.08)',
    glassShadow:  '0 8px 32px rgba(26,27,38,0.08), 0 1px 2px rgba(26,27,38,0.04)',
    glassShadowStrong: '0 20px 60px rgba(26,27,38,0.16), 0 4px 12px rgba(26,27,38,0.06)',
    scrim: 'rgba(26,27,38,0.38)',
  },

  // ── v1 Dark / Tokyo Night (preserved) ──────────────────────────────────
  dark: {
    bg:          '#1A1B26',
    bg2:         '#13141C',
    surface:     '#24283B',
    surfaceAlt:  '#292E42',
    surfaceWarm: '#2A2F48',

    border:       'rgba(192,202,245,0.08)',
    borderStrong: 'rgba(192,202,245,0.14)',
    hairline:     'rgba(192,202,245,0.05)',

    text:     '#C0CAF5',
    textSec:  '#9AA1C1',
    textMuted:'#565F89',
    textFaint:'#414868',

    accent:       '#7AA2F7',
    accentHover:  '#8FB3FA',
    accentSoft:   'rgba(122,162,247,0.14)',
    accentFaint:  'rgba(122,162,247,0.22)',
    accentTextOn: '#1A1B26',

    meet:     '#F7768E',
    task:     '#7AA2F7',
    memo:     '#E0AF68',
    personal: '#BB9AF7',
    daily:    '#9ECE6A',

    danger:   '#F7768E',
    success:  '#9ECE6A',
    warning:  '#E0AF68',

    skel:  'rgba(192,202,245,0.08)',
    skel2: 'rgba(192,202,245,0.04)',

    glassBg:      'rgba(30,33,50,0.68)',
    glassBgSheet: 'rgba(36,40,59,0.85)',
    glassHighlight: 'rgba(192,202,245,0.10)',
    glassBorder:  'rgba(192,202,245,0.10)',
    glassShadow:  '0 8px 32px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.2)',
    glassShadowStrong: '0 20px 60px rgba(0,0,0,0.55), 0 4px 12px rgba(0,0,0,0.25)',
    scrim: 'rgba(0,0,0,0.55)',
  },

  // ── Ant Design 5 + Liquid Glass ────────────────────────────────────────
  ant: {
    bg:          '#F5F5F5',   // ant layout bg
    bg2:         '#FAFAFA',
    surface:     '#FFFFFF',
    surfaceAlt:  '#FAFAFA',
    surfaceWarm: '#F0F0F0',

    border:       '#F0F0F0',  // splitLineColor
    borderStrong: '#D9D9D9',  // borderBase
    hairline:     '#F5F5F5',

    text:     'rgba(0,0,0,0.88)',
    textSec:  'rgba(0,0,0,0.65)',
    textMuted:'rgba(0,0,0,0.45)',
    textFaint:'rgba(0,0,0,0.25)',

    accent:       '#1677FF',   // blue-6 (primary)
    accentHover:  '#4096FF',
    accentSoft:   '#E6F4FF',   // blue-1
    accentFaint:  '#BAE0FF',   // blue-2
    accentTextOn: '#FFFFFF',

    // Ant categorical: red-6, blue-6, gold-6, purple-6, green-6
    meet:     '#F5222D',       // red-6
    task:     '#1677FF',       // blue-6
    memo:     '#FAAD14',       // gold-6
    personal: '#722ED1',       // purple-6
    daily:    '#52C41A',       // green-6

    danger:   '#FF4D4F',       // red-5 (error)
    success:  '#52C41A',
    warning:  '#FAAD14',

    skel:  'rgba(0,0,0,0.06)',
    skel2: 'rgba(0,0,0,0.03)',

    // Liquid glass — crisp white with subtle blue tint
    glassBg:      'rgba(255,255,255,0.72)',
    glassBgSheet: 'rgba(255,255,255,0.88)',
    glassHighlight: 'rgba(255,255,255,0.95)',
    glassBorder:  'rgba(0,0,0,0.06)',
    glassShadow:  '0 6px 16px rgba(0,0,0,0.08), 0 3px 6px rgba(0,0,0,0.04), 0 9px 28px 8px rgba(0,0,0,0.03)',
    glassShadowStrong: '0 12px 48px 16px rgba(0,0,0,0.08), 0 9px 28px rgba(0,0,0,0.05), 0 6px 16px rgba(0,0,0,0.08)',
    scrim: 'rgba(0,0,0,0.45)',
  },
};

// Font stacks
const WW26_FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif`;
const WW26_MONO = `"Berkeley Mono", "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace`;
const WW26_DISPLAY = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Apple SD Gothic Neo", system-ui, sans-serif`;

// Resolve a theme name ('light'|'dark'|'ant') to a color object with .theme flag
function ww26Resolve(theme) {
  const key = (theme === 'dark' || theme === 'ant') ? theme : 'light';
  return { ...WW26_COLORS[key], theme: key, dark: key === 'dark' };
}

function ww26Glass(c, { level = 1, elevated = false } = {}) {
  const backdrop = level === 3 ? 'blur(40px) saturate(180%)' : 'blur(28px) saturate(170%)';
  return {
    background: level === 3 ? c.glassBgSheet : c.glassBg,
    backdropFilter: backdrop,
    WebkitBackdropFilter: backdrop,
    border: `0.5px solid ${c.glassBorder}`,
    boxShadow: elevated ? c.glassShadowStrong : c.glassShadow,
    position: 'relative',
  };
}

function WW26GlassHighlight({ c, radius = 'inherit' }) {
  return (
    <span style={{
      position: 'absolute', top: 0, left: 8, right: 8, height: 1,
      background: `linear-gradient(90deg, transparent, ${c.glassHighlight}, transparent)`,
      borderRadius: radius,
      pointerEvents: 'none',
    }} />
  );
}

function WW26Icon({ name, size = 20, color = 'currentColor', sw = 1.85 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'search':  return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'inbox':   return <svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-6z"/></svg>;
    case 'settings':return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'users':   return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'folder':  return <svg {...p}><path d="M4 4h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>;
    case 'alert':   return <svg {...p}><path d="m12 3 10 18H2L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".5" fill={color}/></svg>;
    case 'file':    return <svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>;
    case 'cloud-off': return <svg {...p}><path d="M9 9a5 5 0 0 1 10 1c2 0 4 1.5 4 4 0 1.3-.6 2.4-1.5 3.2"/><path d="M2 2l20 20"/><path d="M15 17H5a4 4 0 0 1-1-7.9"/></svg>;
    case 'plus':    return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'chevron': return <svg {...p}><path d="m9 18 6-6-6-6"/></svg>;
    case 'home':    return <svg {...p}><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>;
    case 'check':   return <svg {...p}><path d="m4 12 5 5L20 6"/></svg>;
    case 'mic':     return <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 19v3"/></svg>;
    case 'pen':     return <svg {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>;
    case 'calendar':return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
    case 'camera':  return <svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
    case 'bell':    return <svg {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    case 'chev-right': return <svg {...p}><path d="m9 18 6-6-6-6"/></svg>;
    case 'chev-left':  return <svg {...p}><path d="m15 18-6-6 6-6"/></svg>;
    case 'copy':    return <svg {...p}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>;
    case 'sparkles': return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'arrow-up':  return <svg {...p}><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
    case 'dots':    return <svg {...p}><circle cx="5" cy="12" r="1.5" fill={color}/><circle cx="12" cy="12" r="1.5" fill={color}/><circle cx="19" cy="12" r="1.5" fill={color}/></svg>;
    case 'ellipsis': return <svg {...p}><circle cx="5" cy="12" r="1.5" fill={color}/><circle cx="12" cy="12" r="1.5" fill={color}/><circle cx="19" cy="12" r="1.5" fill={color}/></svg>;
    case 'arrow-right': return <svg {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    default: return null;
  }
}

Object.assign(window, {
  WW26_COLORS, WW26_FONT, WW26_MONO, WW26_DISPLAY,
  ww26Resolve, ww26Glass, WW26GlassHighlight, WW26Icon,
});
