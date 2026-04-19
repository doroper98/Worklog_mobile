// HomeView.jsx — Workwiki Mobile HomeView
// Single stateless view; tweak `mode` prop: 'normal' | 'loading' | 'empty'

const WW_COLORS = {
  light: {
    bg: '#F4F3EF',
    bg2: '#EDEBE5',
    surface: '#FFFFFF',
    surfaceAlt: '#FAF9F6',
    border: 'rgba(26,27,38,0.08)',
    borderStrong: 'rgba(26,27,38,0.14)',
    text: '#1A1B26',
    textSec: '#4B4D60',
    textMuted: '#8A8D9F',
    accent: '#3D5AFE',
    accentSoft: 'rgba(61,90,254,0.08)',
    accentFaint: 'rgba(61,90,254,0.12)',
    meet: '#C2456F',
    task: '#3D5AFE',
    memo: '#B07A1F',
    personal: '#7A4FB5',
    daily: '#2E7D57',
    skel: 'rgba(26,27,38,0.06)',
    skel2: 'rgba(26,27,38,0.03)',
  },
  dark: {
    bg: '#1A1B26',
    bg2: '#13141C',
    surface: '#24283B',
    surfaceAlt: '#292E42',
    border: 'rgba(192,202,245,0.08)',
    borderStrong: 'rgba(192,202,245,0.14)',
    text: '#C0CAF5',
    textSec: '#9AA1C1',
    textMuted: '#565F89',
    accent: '#7AA2F7',
    accentSoft: 'rgba(122,162,247,0.12)',
    accentFaint: 'rgba(122,162,247,0.18)',
    meet: '#F7768E',
    task: '#7AA2F7',
    memo: '#E0AF68',
    personal: '#BB9AF7',
    daily: '#9ECE6A',
    skel: 'rgba(192,202,245,0.06)',
    skel2: 'rgba(192,202,245,0.03)',
  },
};

const FONT = `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "SF Pro Text", "Noto Sans KR", system-ui, sans-serif`;
const MONO = `"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace`;

// ─── Logo mark — stacked-page glyph reading as "W" negative space ────────
function WorkwikiMark({ size = 22, color = 'currentColor', strokeWidth = 1.6 }) {
  // Two offset pages with subtle W notch. Minimal, monogram-ish.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.5 4.5h11.5l3.5 3.5v11.5H7.5L4.5 16.5v-12z"
        stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <path d="M9 9.5l1.3 5 1.7-3.4 1.7 3.4 1.3-5"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Icons (lucide-style, inline) ────────────────────────────────────────
function Icon({ name, size = 18, color = 'currentColor', sw = 1.75 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'search':  return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
    case 'inbox':   return <svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-6z"/></svg>;
    case 'settings':return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'users':   return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'folder':  return <svg {...p}><path d="M4 4h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>;
    case 'alert':   return <svg {...p}><path d="m12 3 10 18H2L12 3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".5" fill={color}/></svg>;
    case 'file':    return <svg {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>;
    case 'sun':     return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>;
    case 'cloud-off': return <svg {...p}><path d="M9 9a5 5 0 0 1 10 1c2 0 4 1.5 4 4 0 1.3-.6 2.4-1.5 3.2"/><path d="M2 2l20 20"/><path d="M15 17H5a4 4 0 0 1-1-7.9"/></svg>;
    case 'plus':    return <svg {...p}><path d="M12 5v14M5 12h14"/></svg>;
    case 'chevron': return <svg {...p}><path d="m9 18 6-6-6-6"/></svg>;
    case 'home':    return <svg {...p}><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>;
    case 'dot':     return <svg {...p}><circle cx="12" cy="12" r="2" fill={color}/></svg>;
    case 'check':   return <svg {...p}><path d="m4 12 5 5L20 6"/></svg>;
    case 'mic':     return <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 19v3"/></svg>;
    case 'pen':     return <svg {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>;
    case 'calendar':return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
    default: return null;
  }
}

// ─── Skeleton bar ─────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 12, r = 4, c }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: `linear-gradient(90deg, ${c.skel2}, ${c.skel} 40%, ${c.skel2} 80%)`,
      backgroundSize: '200% 100%',
      animation: 'ww-sk 1.6s ease-in-out infinite',
    }} />
  );
}

// ─── Section title ────────────────────────────────────────────────────────
function SectionTitle({ title, detail, c }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '0 20px', marginBottom: 10,
    }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: c.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{title}</div>
      {detail && <div style={{ fontSize: 12, color: c.textMuted, fontFamily: MONO }}>{detail}</div>}
    </div>
  );
}

// ─── Slate type meta ──────────────────────────────────────────────────────
const SLATE_KIND = {
  meeting: { label: '회의', short: '회의', colorKey: 'meet' },
  task:    { label: '업무', short: '업무', colorKey: 'task' },
  memo:    { label: '메모', short: '메모', colorKey: 'memo' },
  personal:{ label: '개인', short: '개인', colorKey: 'personal' },
};

const TODAY_SLATES = [
  { kind: 'meeting', time: '09:30', title: '담당급 시뮬레이션 개발 현황 논의', md: true },
  { kind: 'task',    time: '10:40', title: 'RSM I/F 상세설계 검토',          md: true },
  { kind: 'task',    time: '11:15', title: 'Pilot 작업의뢰 63 M/D 확정',     md: true },
  { kind: 'memo',    time: '13:05', title: '권용환 라이선스 분석 읽고 메모',   md: false },
  { kind: 'meeting', time: '14:00', title: '저항해석 Toolkit 연계 협의',      md: true },
  { kind: 'personal',time: '15:30', title: 'KPI 자기평가 초안',              md: false },
  { kind: 'task',    time: '16:20', title: 'PDA-T View Table 전달',          md: true },
  { kind: 'memo',    time: '17:10', title: '주간 보고 초안 메모',            md: false },
  { kind: 'meeting', time: '18:00', title: '팀 주간 회의',                    md: false },
  { kind: 'personal',time: '19:40', title: '저녁 회고 메모',                  md: false },
];

function SlateRow({ slate, c, isLast, active, onClick }) {
  const meta = SLATE_KIND[slate.kind];
  const dot = c[meta.colorKey];
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 14px 7px 14px',
      borderBottom: isLast ? 'none' : `1px solid ${c.border}`,
      background: active ? c.accentSoft : 'transparent',
      minHeight: 34, cursor: 'pointer',
      position: 'relative',
    }}>
      {active && <span style={{
        position: 'absolute', left: 0, top: 6, bottom: 6, width: 2,
        background: c.accent, borderRadius: '0 2px 2px 0',
      }} />}
      <span style={{
        width: 6, height: 6, borderRadius: 3, background: dot, flexShrink: 0,
      }} />
      <span style={{
        fontFamily: MONO, fontSize: 10, color: c.textMuted,
        width: 32, flexShrink: 0,
      }}>{slate.time}</span>
      <div style={{
        fontSize: 13, fontWeight: 500, color: c.text,
        flex: 1, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        letterSpacing: '-0.01em',
      }}>{slate.title}</div>
      <span style={{
        fontFamily: MONO, fontSize: 8, fontWeight: 700,
        padding: '1px 4px', borderRadius: 3, letterSpacing: '0.02em',
        color: slate.md ? c.daily : c.textMuted,
        background: slate.md ? `${c.daily}1A` : c.surfaceAlt,
      }}>MD</span>
    </div>
  );
}

// ─── Today's slates (desktop-parity terminology) ──────────────────────────
function TodayCard({ c, mode, slates, activeId, onSelect, scrollable = true, limit = 5 }) {
  if (mode === 'loading') {
    return (
      <div style={{
        margin: '0 16px',
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 14, overflow: 'hidden',
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            padding: '9px 14px',
            borderBottom: i < 4 ? `1px solid ${c.border}` : 'none',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: c.skel }} />
            <Skel c={c} w={32} h={9} r={3} />
            <Skel c={c} w={'55%'} h={10} r={3} />
            <div style={{ flex: 1 }} />
            <Skel c={c} w={18} h={9} r={3} />
          </div>
        ))}
      </div>
    );
  }
  const list = slates || TODAY_SLATES;
  const total = list.length;
  const ROW_H = 34;
  return (
    <div style={{
      margin: '0 16px',
      background: c.surface, border: `1px solid ${c.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div
        className="ww-scroll"
        style={{
          maxHeight: scrollable ? ROW_H * limit : 'none',
          overflowY: scrollable && total > limit ? 'auto' : 'visible',
        }}
      >
        {list.map((s, i) => (
          <SlateRow
            key={i}
            slate={s}
            c={c}
            isLast={i === total - 1}
            active={activeId === i}
            onClick={() => onSelect && onSelect(i)}
          />
        ))}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        borderTop: `1px solid ${c.border}`, background: c.surfaceAlt,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          padding: '2px 6px', borderRadius: 4, letterSpacing: '0.02em',
          color: c.textMuted, background: c.bg2,
          border: `1px solid ${c.border}`,
        }}>DAILY</span>
        <span style={{ fontSize: 11, color: c.textMuted, flex: 1 }}>
          업무 종료 후 Daily MD 생성
        </span>
        <span style={{ fontSize: 10, color: c.textMuted, fontFamily: MONO }}>대기 중</span>
      </div>
    </div>
  );
}

function TodayEmpty({ c, isToday = true }) {
  return (
    <div style={{
      margin: '0 16px', padding: '22px 18px',
      background: c.surface, border: `1px dashed ${c.borderStrong}`,
      borderRadius: 14,
    }}>
      <div style={{ fontSize: 14, color: c.text, marginBottom: 6 }}>
        {isToday ? '아직 오늘의 슬레이트가 없습니다' : '이 날 슬레이트 없음'}
      </div>
      <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.55 }}>
        데스크탑에서 회의·업무·메모·개인 슬레이트를 생성하거나,<br/>
        하단 FAB으로 빠른 메모를 남길 수 있습니다.
      </div>
    </div>
  );
}

// ─── Wiki category grid (2×2) ─────────────────────────────────────────────
function WikiGrid({ c, mode }) {
  const cats = [
    { key: 'people',   title: 'People',   detail: '72',  icon: 'users',  accent: c.accent },
    { key: 'projects', title: 'Projects', detail: '81',  icon: 'folder', accent: c.accent },
    { key: 'issues',   title: 'Issues',   detail: '167', icon: 'alert',  accent: c.accent },
    { key: 'notes',    title: 'Notes',    detail: '18',  icon: 'file',   accent: c.accent },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      margin: '0 16px',
    }}>
      {cats.map(cat => (
        <div key={cat.key} style={{
          background: c.surface, border: `1px solid ${c.border}`,
          borderRadius: 14, padding: '14px 14px 12px',
          display: 'flex', flexDirection: 'column', gap: 10,
          minHeight: 78,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: c.accentSoft, color: c.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={cat.icon} size={16} />
            </div>
            <div style={{
              fontFamily: MONO, fontSize: 13, fontWeight: 600,
              color: c.textSec, letterSpacing: '-0.02em',
            }}>{mode === 'loading' ? <Skel c={c} w={22} h={11} r={3} /> : cat.detail}</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: c.text, letterSpacing: '-0.01em' }}>
            {cat.title}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Recent list ──────────────────────────────────────────────────────────
const RECENT_DATA = [
  { cat: 'projects', title: 'c-DN',                               sub: 'Cell Design Network · 진행중',       stamp: '1시간 전', accent: 'task' },
  { cat: 'projects', title: 'Pilot 작업의뢰',                       sub: '63 M/D · RSM I/F 협의 진행',         stamp: '3시간 전', accent: 'task' },
  { cat: 'issues',   title: 'RSM 시스템 구조 I/F 상세설계 불가',     sub: '미해결 · 구조 미확인',               stamp: '어제',     accent: 'meet' },
  { cat: 'people',   title: '권용환',                               sub: '구조해석 리소스·라이선스 자료 회신',   stamp: '어제',     accent: 'memo' },
  { cat: 'notes',    title: 'weekly-2026-04-09-to-2026-04-23',     sub: '주간 업무보고 · 04/17 작성',          stamp: '2일 전',   accent: 'daily' },
];

function RecentRow({ item, c, isLast }) {
  const dot = c[item.accent] || c.accent;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 14px',
      borderBottom: isLast ? 'none' : `1px solid ${c.border}`,
      minHeight: 34,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: 3, background: dot, flexShrink: 0,
      }} />
      <span style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700,
        color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em',
        width: 52, flexShrink: 0,
      }}>{item.cat}</span>
      <div style={{
        fontSize: 13, fontWeight: 500, color: c.text,
        flex: 1, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        letterSpacing: '-0.01em',
      }}>{item.title}</div>
      <span style={{
        fontSize: 10, color: c.textMuted, fontFamily: MONO,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>{item.stamp}</span>
    </div>
  );
}

function RecentList({ c, mode }) {
  if (mode === 'loading') {
    return (
      <div style={{
        margin: '0 16px', background: c.surface,
        border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden',
      }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            padding: '9px 14px',
            borderBottom: i < 4 ? `1px solid ${c.border}` : 'none',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: c.skel }} />
            <Skel c={c} w={40} h={9} r={3} />
            <Skel c={c} w={'55%'} h={10} r={3} />
            <div style={{ flex: 1 }} />
            <Skel c={c} w={28} h={9} r={3} />
          </div>
        ))}
      </div>
    );
  }
  if (mode === 'empty') {
    return (
      <div style={{
        margin: '0 16px', padding: '24px 20px',
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 14, textAlign: 'center',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: c.accentSoft, color: c.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 10px',
        }}>
          <Icon name="file" size={18} />
        </div>
        <div style={{ fontSize: 14, color: c.text, marginBottom: 4 }}>
          아직 열어본 문서가 없습니다
        </div>
        <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.55 }}>
          검색이나 Wiki 카테고리에서 문서를 열면<br/>여기에 최근 20개가 쌓입니다.
        </div>
      </div>
    );
  }
  return (
    <div style={{
      margin: '0 16px', background: c.surface,
      border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden',
    }}>
      {RECENT_DATA.map((item, i) => (
        <RecentRow key={i} item={item} c={c} isLast={i === RECENT_DATA.length - 1} />
      ))}
      <div style={{
        padding: '8px 14px', textAlign: 'center',
        fontSize: 12, color: c.accent, fontWeight: 500,
        borderTop: `1px solid ${c.border}`, background: c.surfaceAlt,
      }}>더 보기 <span style={{ fontFamily: MONO, color: c.textMuted, marginLeft: 4 }}>15</span></div>
    </div>
  );
}

// ─── Search bar ───────────────────────────────────────────────────────────
function SearchBar({ c }) {
  return (
    <div style={{ padding: '0 16px 8px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 40, padding: '0 14px',
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 12,
      }}>
        <Icon name="search" size={16} color={c.textMuted} />
        <div style={{ fontSize: 15, color: c.textMuted, flex: 1 }}>
          위키·일지·인물 검색
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 600,
          color: c.textMuted, padding: '3px 6px',
          background: c.surfaceAlt, border: `1px solid ${c.border}`,
          borderRadius: 4, letterSpacing: '0.04em',
        }}>339</div>
      </div>
    </div>
  );
}

// ─── Top app bar (wordmark + sync state) ──────────────────────────────────
function AppBar({ c, mode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: c.accent, color: c.dark ? '#0D0E14' : '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 8px ${c.accentFaint}`,
        }}>
          <WorkwikiMark size={19} color="#fff" strokeWidth={1.8} />
        </div>
        <div>
          <div style={{
            fontSize: 17, fontWeight: 700, color: c.text,
            letterSpacing: '-0.02em', lineHeight: 1.1,
          }}>Workwiki</div>
          <div style={{
            fontSize: 10, color: c.textMuted, fontFamily: MONO,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 1,
          }}>mobile · v3.17</div>
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px 5px 8px',
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 14, fontSize: 11, color: c.textSec,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: mode === 'loading' ? c.memo : c.daily,
          boxShadow: `0 0 8px ${mode === 'loading' ? c.memo : c.daily}`,
        }} />
        <span style={{ fontFamily: MONO }}>
          {mode === 'loading' ? '동기화 중' : '동기화됨 · 2분 전'}
        </span>
      </div>
    </div>
  );
}

// ─── Bottom tab bar ───────────────────────────────────────────────────────
function TabBar({ c, active = 'home', onSelect }) {
  const tabs = [
    { k: 'home', label: '홈', icon: 'home' },
    { k: 'calendar', label: '달력', icon: 'calendar' },
    { k: 'inbox', label: '보낸 메모', icon: 'inbox' },
    { k: 'settings', label: '설정', icon: 'settings' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 88,
      background: c.bg2,
      borderTop: `0.5px solid ${c.border}`,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
      paddingTop: 10, zIndex: 40,
    }}>
      {tabs.map(t => (
        <button key={t.k} onClick={() => onSelect && onSelect(t.k)} style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 4, padding: '4px 0',
          color: t.k === active ? c.accent : c.textMuted,
          background: 'transparent', border: 'none', cursor: 'pointer',
        }}>
          <Icon name={t.icon} size={22} sw={t.k === active ? 2 : 1.75} />
          <div style={{
            fontSize: 10, fontWeight: t.k === active ? 600 : 500,
            letterSpacing: '-0.01em',
          }}>{t.label}</div>
        </button>
      ))}
    </div>
  );
}

// ─── FAB ──────────────────────────────────────────────────────────────────
function FAB({ c }) {
  return (
    <div style={{
      position: 'absolute', right: 20, bottom: 100, zIndex: 45,
      width: 56, height: 56, borderRadius: 28,
      background: c.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
      boxShadow: `0 8px 24px ${c.accentFaint}, 0 2px 6px rgba(0,0,0,0.15)`,
    }}>
      <Icon name="pen" size={22} color="#fff" sw={2} />
    </div>
  );
}

// ─── Offline banner ───────────────────────────────────────────────────────
function OfflineBanner({ c, show }) {
  if (!show) return null;
  return (
    <div style={{
      margin: '0 16px 10px',
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: c.accentSoft,
      border: `1px solid ${c.accentFaint}`,
      borderRadius: 10,
      fontSize: 12, color: c.accent,
    }}>
      <Icon name="cloud-off" size={14} color={c.accent} />
      <span>오프라인 — 캐시 버전 표시 중</span>
    </div>
  );
}

// ─── Main composition ────────────────────────────────────────────────────
function HomeView({
  dark = false, mode = 'normal', offline = false,
  activeSlate = null, onSelectSlate,
  selectedDate = WW_TODAY,
  onSelectDate,
  onNavigateTab,
}) {
  const c = { ...(dark ? WW_COLORS.dark : WW_COLORS.light), dark };
  const ref = React.useRef(null);
  const isToday = selectedDate === WW_TODAY;
  const dateSlates = mode === 'empty' ? [] : wwSlatesFor(selectedDate);
  const d = wwParseDate(selectedDate);
  const dowShort = ['일','월','화','수','목','금','토'][d.getDay()];
  const sectionTitle = isToday
    ? `오늘 · ${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${dowShort}`
    : `${d.getMonth() + 1}월 ${d.getDate()}일 ${dowShort}`;

  return (
    <div ref={ref} style={{
      fontFamily: FONT,
      background: c.bg,
      color: c.text,
      height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* scrolling content */}
      <div className="ww-scroll" style={{
        flex: 1, overflow: 'auto',
        paddingTop: 56, // status bar
        paddingBottom: 100, // tab bar + FAB
      }}>
        <AppBar c={c} mode={mode} />
        <SearchBar c={c} />
        <OfflineBanner c={c} show={offline} />

        <WeekStrip
          c={c}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onMonthTap={() => onNavigateTab && onNavigateTab('calendar')}
          onTodayTap={() => onSelectDate && onSelectDate(WW_TODAY)}
        />

        <div style={{ height: 8 }} />
        <SectionTitle
          title={sectionTitle}
          detail={mode === 'empty' ? '0 slates' : `${dateSlates.length} slates`}
          c={c}
        />
        {mode === 'empty' || dateSlates.length === 0
          ? <TodayEmpty c={c} isToday={isToday} />
          : <TodayCard c={c} mode={mode} slates={dateSlates} activeId={activeSlate} onSelect={onSelectSlate} />}

        <div style={{ height: 24 }} />
        <SectionTitle title="최근 열어본 문서" detail={mode === 'empty' ? '0' : '20'} c={c} />
        <RecentList c={c} mode={mode} />

        <div style={{ height: 24 }} />
        <SectionTitle title="Wiki" detail="4 categories" c={c} />
        <WikiGrid c={c} mode={mode} />

        <div style={{ height: 16 }} />
      </div>

      <FAB c={c} />
      <TabBar c={c} active="home" onSelect={onNavigateTab} />

      <style>{`
        @keyframes ww-sk {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .ww-scroll { scrollbar-width: thin; scrollbar-color: ${c.borderStrong} transparent; }
        .ww-scroll::-webkit-scrollbar { width: 3px; height: 3px; background: transparent; }
        .ww-scroll::-webkit-scrollbar-track { background: transparent; }
        .ww-scroll::-webkit-scrollbar-thumb { background: ${c.borderStrong}; border-radius: 3px; }
        .ww-scroll::-webkit-scrollbar-thumb:hover { background: ${c.textMuted}; }
        .ww-scroll::-webkit-scrollbar-corner { background: transparent; }
      `}</style>
    </div>
  );
}

Object.assign(window, { HomeView, WorkwikiMark, SlateRow, FAB, TabBar, TODAY_SLATES, SLATE_KIND });
