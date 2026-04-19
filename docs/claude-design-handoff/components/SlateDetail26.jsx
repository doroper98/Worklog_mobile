// SlateDetail26.jsx — iOS 26 Liquid Glass slate detail sheet
// Depends on: WW26Theme.jsx (tokens/icons), SlateDetail.jsx (MDBody, SlateBody, SlateEmpty, MDPending)

function WW26CopyBtn({ c, size = 26 }) {
  return (
    <button title="복사" style={{
      width: size, height: size,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'transparent', border: 'none',
      borderRadius: 7, cursor: 'pointer', color: c.textMuted,
    }}>
      <WW26Icon name="copy" size={14} color={c.textMuted} sw={1.9} />
    </button>
  );
}

function WW26SegTab({ c, active, disabled, label, meta, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 11px',
        borderRadius: 8,
        border: 'none',
        background: active ? c.accent : 'transparent',
        color: active ? c.accentTextOn : disabled ? c.textMuted : c.textSec,
        opacity: disabled ? 0.55 : 1,
        fontFamily: WW26_MONO, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
      {meta && (
        <span style={{
          fontFamily: WW26_MONO, fontSize: 9, fontWeight: 700,
          padding: '1px 4px', borderRadius: 3,
          background: active ? 'rgba(255,255,255,0.22)' : c.surfaceAlt,
          color: active ? c.accentTextOn : c.textMuted,
          letterSpacing: '0.02em',
        }}>{meta}</span>
      )}
    </button>
  );
}

function WW26ActionBtn({ icon, label, c, primary }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '10px 16px',
      borderRadius: 12,
      border: primary ? 'none' : `1px solid ${c.border}`,
      background: primary ? c.accent : c.surface,
      color: primary ? c.accentTextOn : c.textSec,
      fontFamily: WW26_FONT, fontSize: 13, fontWeight: 600,
      letterSpacing: '-0.01em',
      cursor: 'pointer',
      minHeight: 42,
      boxShadow: primary ? `0 4px 14px ${c.accentFaint}` : 'none',
    }}>
      <WW26Icon name={icon} size={15} color={primary ? c.accentTextOn : c.textSec} sw={2} />
      {label}
    </button>
  );
}

function SlateDetail26Sheet({ slate, c, onClose }) {
  if (!slate) return null;
  const meta = WW26_SLATE_KIND[slate.kind];
  const dot = c[meta.colorKey];
  const hasSlate = slate.hasSlate !== false;
  const hasMD = !!slate.md;
  const defaultTab = hasMD ? 'md' : 'slate';
  const [tab, setTab] = React.useState(slate.forceTab || defaultTab);
  const slateId = `slate-${String(240 + (slate.idx || 0)).padStart(4, '0')}`;

  return (
    <>
      {/* scrim — warm dark with backdrop blur */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 60,
          background: c.scrim,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />
      {/* sheet — glass level 3 */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 65,
        background: c.glassBgSheet,
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        borderTop: `0.5px solid ${c.glassBorder}`,
        boxShadow: c.glassShadowStrong,
        maxHeight: '90%',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* specular highlight */}
        <span style={{
          position: 'absolute', top: 0, left: 24, right: 24, height: 1,
          background: `linear-gradient(90deg, transparent, ${c.glassHighlight}, transparent)`,
          pointerEvents: 'none',
        }} />

        {/* grabber — iOS 26 style, slightly thicker+wider */}
        <div style={{
          padding: '10px 0 6px', display: 'flex', justifyContent: 'center',
        }}>
          <div style={{
            width: 40, height: 5, borderRadius: 3,
            background: c.borderStrong,
          }} />
        </div>

        {/* meta row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 20px 8px',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 9px 3px 7px',
            background: `${dot}1F`, borderRadius: 7,
            fontSize: 11, fontWeight: 700, color: dot,
            letterSpacing: '0.02em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />
            {meta.label}
          </span>
          <span style={{
            fontFamily: WW26_MONO, fontSize: 11, color: c.textMuted,
            fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em',
          }}>
            2026-04-19 · {slate.time}
          </span>
          <div style={{ flex: 1 }} />
          <button title="더 보기" style={{
            width: 28, height: 28, borderRadius: 14,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: c.surfaceAlt, border: 'none', cursor: 'pointer',
          }}>
            <WW26Icon name="ellipsis" size={15} color={c.textMuted} sw={2} />
          </button>
        </div>

        {/* title */}
        <div style={{
          padding: '0 20px 4px',
          fontFamily: WW26_DISPLAY,
          fontSize: 21, fontWeight: 700, color: c.text,
          letterSpacing: '-0.025em', lineHeight: 1.28,
        }}>{slate.title}</div>

        {/* id + tabs + copy */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 14px 12px 20px',
        }}>
          <span style={{
            fontFamily: WW26_MONO, fontSize: 11, color: c.textMuted,
            whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
          }}>[[{slateId}]]</span>
          <WW26CopyBtn c={c} size={22} />
          <div style={{ flex: 1 }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: 2, borderRadius: 10,
            background: c.surfaceAlt,
          }}>
            <WW26SegTab c={c} active={tab === 'slate'} label="Slate"
              meta={hasSlate ? null : '빈 본문'} onClick={() => setTab('slate')} />
            <WW26SegTab c={c} active={tab === 'md'} disabled={!hasMD} label="MD"
              meta={hasMD ? null : '대기'} onClick={() => hasMD && setTab('md')} />
          </div>
          <WW26CopyBtn c={c} size={26} />
        </div>

        {/* body — paper surface, not glass (for readability) */}
        <div className="ww-scroll" style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 20px 20px',
          borderTop: `0.5px solid ${c.hairline}`,
          background: c.bg2,
          position: 'relative',
        }}>
          {/* top fade */}
          <div style={{
            position: 'sticky', top: -16, left: 0, right: 0, height: 12,
            margin: '-16px -20px 4px',
            background: `linear-gradient(180deg, ${c.bg2}, transparent)`,
            pointerEvents: 'none', zIndex: 2,
          }} />
          {tab === 'md' && hasMD && <MDBody slate={slate} c={c} />}
          {tab === 'md' && !hasMD && <MDPending c={c} />}
          {tab === 'slate' && hasSlate && <SlateBody slate={slate} c={c} />}
          {tab === 'slate' && !hasSlate && <SlateEmpty c={c} />}
        </div>

        {/* action bar — glass level 1 */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '12px 16px 18px',
          borderTop: `0.5px solid ${c.glassBorder}`,
          background: c.glassBg,
          backdropFilter: 'blur(28px) saturate(170%)',
          WebkitBackdropFilter: 'blur(28px) saturate(170%)',
        }}>
          <WW26ActionBtn icon="pen" label="편집" c={c} />
          <div style={{ flex: 1 }} />
          <WW26ActionBtn icon="sparkles" label="Claude에 묻기" c={c} primary />
        </div>
      </div>
    </>
  );
}

Object.assign(window, { SlateDetail26Sheet });
