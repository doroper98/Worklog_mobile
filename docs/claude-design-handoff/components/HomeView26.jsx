// HomeView26.jsx — iOS 26 Liquid Glass + Warm Earth version
// Depends on: CalendarData.jsx (today/slate mocks), WW26Theme.jsx (tokens + icons)

const C26 = WW26_COLORS; // alias

// Logo — paper stack with serif-ish W notch (more refined than v1)
function WW26Mark({ size = 22, color = 'currentColor', sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4.5 4.5h11.5l3.5 3.5v11.5H7.5L4.5 16.5v-12z"
        stroke={color} strokeWidth={sw} strokeLinejoin="round" />
      <path d="M9 10l1.4 4.8L12 12l1.6 2.8L15 10"
        stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Status bar-aware dynamic-island style sync pill ─────────────────────
function WW26SyncPill({ c, mode }) {
  const syncing = mode === 'loading';
  const label = syncing ? '동기화 중' : '동기화됨 · 2분 전';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px 5px 8px',
      borderRadius: 999,
      ...ww26Glass(c, { level: 1 }),
      fontSize: 11, color: c.textSec,
      overflow: 'hidden',
    }}>
      <WW26GlassHighlight c={c} radius={999} />
      <span style={{
        width: 6, height: 6, borderRadius: 3,
        background: syncing ? c.warning : c.success,
        boxShadow: `0 0 8px ${syncing ? c.warning : c.success}`,
        animation: syncing ? 'ww26-pulse 1.4s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontFamily: WW26_MONO, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Top bar — wordmark + sync pill (no glass; content scrolls under glass search) ─
function WW26AppBar({ c, mode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: c.accent, color: c.accentTextOn,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 10px ${c.accentFaint}`,
        }}>
          <WW26Mark size={19} color="#fff" sw={1.9} />
        </div>
        <div>
          <div style={{
            fontFamily: WW26_DISPLAY,
            fontSize: 19, fontWeight: 700, color: c.text,
            letterSpacing: '-0.025em', lineHeight: 1.1,
          }}>Workwiki</div>
          <div style={{
            fontSize: 9.5, color: c.textMuted, fontFamily: WW26_MONO,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>mobile · v26.0</div>
        </div>
      </div>
      <WW26SyncPill c={c} mode={mode} />
    </div>
  );
}

// ─── Glass search pill ───────────────────────────────────────────────────
function WW26Search({ c }) {
  return (
    <div style={{ padding: '0 16px 4px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        height: 42, padding: '0 14px',
        borderRadius: 14,
        ...ww26Glass(c, { level: 1 }),
        overflow: 'hidden',
      }}>
        <WW26GlassHighlight c={c} radius={14} />
        <WW26Icon name="search" size={17} color={c.textMuted} sw={2} />
        <div style={{ fontSize: 15, color: c.textMuted, flex: 1 }}>위키·슬레이트·인물 검색</div>
        <div style={{
          fontFamily: WW26_MONO, fontSize: 10, fontWeight: 700,
          color: c.textMuted, padding: '3px 7px',
          background: c.surfaceAlt,
          borderRadius: 5, letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}>339</div>
      </div>
    </div>
  );
}

// ─── Follow-up banner (conditional, top of home) ─────────────────────────
function WW26FollowUpBanner({ c, count = 2, onTap }) {
  if (!count) return null;
  return (
    <div style={{ padding: '8px 16px 0' }}>
      <button onClick={onTap} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%',
        padding: '10px 14px',
        borderRadius: 14,
        border: `1px solid ${c.accentFaint}`,
        background: c.accentSoft,
        color: c.accent,
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: c.accent, color: c.accentTextOn,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <WW26Icon name="bell" size={15} color={c.accentTextOn} sw={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: c.text, letterSpacing: '-0.01em' }}>
            이번 주 Follow-up <span style={{ fontFamily: WW26_MONO, color: c.accent }}>{count}</span>건 대기
          </div>
          <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>
            4/22 남기민 회신 · 4/24 주간 보고 마감
          </div>
        </div>
        <WW26Icon name="chev-right" size={16} color={c.accent} sw={2} />
      </button>
    </div>
  );
}

// ─── Week strip (v2 — glass floating card, slightly taller, iOS 26 spacing) ─
function WW26WeekStrip({ c, selectedDate, onSelectDate, onMonthTap, onTodayTap }) {
  const weekStart = wwStartOfWeekSun(selectedDate);
  const days = wwWeekDays(weekStart);
  const dow = ['일','월','화','수','목','금','토'];

  return (
    <div style={{ padding: '12px 16px 6px' }}>
      <div style={{
        borderRadius: 18,
        padding: '10px 8px 10px',
        ...ww26Glass(c, { level: 1 }),
        overflow: 'hidden',
      }}>
        <WW26GlassHighlight c={c} radius={18} />

        {/* month + Today */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '2px 10px 8px',
        }}>
          <button onClick={onMonthTap} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 0, color: c.text, fontFamily: WW26_DISPLAY,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: c.text, letterSpacing: '-0.015em' }}>
              {wwMonthLabel(selectedDate)}
            </span>
            <WW26Icon name="chevron" size={13} color={c.textMuted} sw={2.2} />
          </button>
          <button
            onClick={onTodayTap}
            disabled={selectedDate === WW_TODAY}
            style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: selectedDate === WW_TODAY ? 'transparent' : c.accent,
              border: 'none',
              color: selectedDate === WW_TODAY ? c.textMuted : c.accentTextOn,
              fontFamily: WW26_MONO, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              cursor: selectedDate === WW_TODAY ? 'default' : 'pointer',
              opacity: selectedDate === WW_TODAY ? 0.5 : 1,
            }}
          >Today</button>
        </div>

        {/* 7 day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {days.map((d, i) => {
            const selected = d === selectedDate;
            const today = d === WW_TODAY;
            const hasSlate = wwHasSlate(d);
            const hasFUp = wwHasFollowUp(d);
            const isSun = i === 0;
            const dayNum = Number(d.slice(-2));

            let bg = 'transparent', txt = c.text, labelColor = c.textMuted, dotBg = c.accent;
            if (today && !selected) { bg = c.accent; txt = c.accentTextOn; labelColor = 'rgba(255,255,255,0.8)'; dotBg = 'rgba(255,255,255,0.85)'; }
            else if (selected) { bg = c.accentSoft; txt = c.accent; labelColor = c.accent; }
            else if (isSun) { txt = c.danger; }

            return (
              <button key={d} onClick={() => onSelectDate && onSelectDate(d)} style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '4px 0 6px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderRadius: 10,
              }}>
                <div style={{
                  fontFamily: WW26_MONO, fontSize: 9, fontWeight: 700,
                  color: selected || today ? labelColor : (isSun ? c.danger : c.textMuted),
                  letterSpacing: '0.04em', marginBottom: 4, opacity: selected || today ? 1 : 0.85,
                }}>{dow[i]}</div>
                <div style={{
                  position: 'relative',
                  width: 34, height: 34, borderRadius: 17,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: bg,
                  fontSize: 15,
                  fontWeight: today || selected ? 700 : 500,
                  color: txt, letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'background 0.15s',
                }}>
                  {dayNum}
                  {hasFUp && (
                    <span style={{
                      position: 'absolute', top: 1, right: 1,
                      width: 6, height: 6, borderRadius: 3,
                      background: today && !selected ? 'rgba(255,255,255,0.95)' : c.danger,
                      boxShadow: today && !selected ? 'none' : `0 0 4px ${c.danger}`,
                    }} />
                  )}
                </div>
                <span style={{
                  width: 4, height: 4, borderRadius: 2, marginTop: 3,
                  background: hasSlate ? dotBg : 'transparent',
                }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Section title (v2) ──────────────────────────────────────────────────
function WW26Section({ title, detail, c, actionLabel, onAction }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      padding: '0 22px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{
          fontFamily: WW26_DISPLAY,
          fontSize: 15, fontWeight: 700, color: c.text,
          letterSpacing: '-0.02em',
        }}>{title}</div>
        {detail && <div style={{
          fontSize: 10, color: c.textMuted, fontFamily: WW26_MONO,
          fontVariantNumeric: 'tabular-nums',
        }}>{detail}</div>}
      </div>
      {actionLabel && (
        <button onClick={onAction} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: c.accent, fontSize: 12, fontWeight: 600, padding: 0,
          fontFamily: WW26_FONT, letterSpacing: '-0.01em',
        }}>{actionLabel}</button>
      )}
    </div>
  );
}

// ─── Slate category meta ─────────────────────────────────────────────────
const WW26_SLATE_KIND = {
  meeting: { label: '회의', colorKey: 'meet' },
  task:    { label: '업무', colorKey: 'task' },
  memo:    { label: '메모', colorKey: 'memo' },
  personal:{ label: '개인', colorKey: 'personal' },
};

// ─── Slate row (v2 — cleaner, same density as v1) ────────────────────────
function WW26SlateRow({ slate, c, isLast, active, onClick }) {
  const meta = WW26_SLATE_KIND[slate.kind];
  const dot = c[meta.colorKey];
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px',
      borderBottom: isLast ? 'none' : `1px solid ${c.hairline}`,
      background: active ? c.accentSoft : 'transparent',
      minHeight: 36, cursor: 'pointer', position: 'relative',
      transition: 'background 0.15s',
    }}>
      {active && <span style={{
        position: 'absolute', left: 0, top: 6, bottom: 6, width: 2.5,
        background: c.accent, borderRadius: '0 2px 2px 0',
      }} />}
      <span style={{
        width: 6, height: 6, borderRadius: 3, background: dot, flexShrink: 0,
      }} />
      <span style={{
        fontFamily: WW26_MONO, fontSize: 10, color: c.textMuted,
        width: 32, flexShrink: 0, fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.01em',
      }}>{slate.time}</span>
      <div style={{
        fontSize: 13.5, fontWeight: 500, color: c.text,
        flex: 1, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        letterSpacing: '-0.015em',
      }}>{slate.title}</div>
      <span style={{
        fontFamily: WW26_MONO, fontSize: 8.5, fontWeight: 700,
        padding: '1.5px 5px', borderRadius: 4, letterSpacing: '0.04em',
        color: slate.md ? c.daily : c.textFaint,
        background: slate.md ? `${c.daily}22` : 'transparent',
        border: slate.md ? 'none' : `1px solid ${c.hairline}`,
      }}>MD</span>
    </div>
  );
}

// ─── Today's slates card (v2) ───────────────────────────────────────────
function WW26TodayCard({ c, mode, slates, activeId, onSelect, limit = 5 }) {
  if (mode === 'loading') {
    return (
      <div style={{
        margin: '0 16px',
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 18, overflow: 'hidden',
        boxShadow: c.glassShadow,
      }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{
            padding: '9px 14px',
            borderBottom: i < 4 ? `1px solid ${c.hairline}` : 'none',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: c.skel }} />
            <div style={{ width: 32, height: 9, background: c.skel, borderRadius: 3 }} />
            <div style={{ flex: 1, height: 11, background: c.skel, borderRadius: 3 }} />
            <div style={{ width: 20, height: 9, background: c.skel, borderRadius: 3 }} />
          </div>
        ))}
      </div>
    );
  }
  const list = slates || [];
  const total = list.length;
  const ROW_H = 36;

  return (
    <div style={{
      margin: '0 16px',
      background: c.surface, border: `1px solid ${c.border}`,
      borderRadius: 18, overflow: 'hidden',
      boxShadow: c.glassShadow,
    }}>
      <div className="ww-scroll" style={{
        maxHeight: total > limit ? ROW_H * limit : 'none',
        overflowY: total > limit ? 'auto' : 'visible',
      }}>
        {list.map((s, i) => (
          <WW26SlateRow
            key={i} slate={s} c={c}
            isLast={i === total - 1}
            active={activeId === i}
            onClick={() => onSelect && onSelect(i)}
          />
        ))}
      </div>
      {/* Daily MD strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        borderTop: `1px solid ${c.hairline}`,
        background: c.surfaceAlt,
      }}>
        <span style={{
          fontFamily: WW26_MONO, fontSize: 9, fontWeight: 700,
          padding: '2px 6px', borderRadius: 4, letterSpacing: '0.06em',
          color: c.daily, background: `${c.daily}15`,
        }}>DAILY</span>
        <span style={{ fontSize: 11, color: c.textMuted, flex: 1 }}>
          업무 종료 후 Daily MD 생성
        </span>
        <span style={{
          fontSize: 10, color: c.textMuted, fontFamily: WW26_MONO,
          letterSpacing: '0.02em',
        }}>대기 중</span>
      </div>
    </div>
  );
}

function WW26DayEmpty({ c, isToday }) {
  return (
    <div style={{
      margin: '0 16px', padding: '22px 18px',
      background: c.surface, border: `1px dashed ${c.borderStrong}`,
      borderRadius: 18,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 4, letterSpacing: '-0.01em' }}>
        {isToday ? '아직 오늘의 슬레이트가 없습니다' : '이 날 슬레이트 없음'}
      </div>
      <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.55 }}>
        하단 FAB으로 빠른 메모를 남기거나 데스크탑에서 생성할 수 있습니다.
      </div>
    </div>
  );
}

// ─── Wiki grid (v2 — refined earth palette) ──────────────────────────────
function WW26WikiGrid({ c, mode }) {
  const cats = [
    { key: 'people',   title: 'People',   detail: '72',  icon: 'users',  tone: c.personal },
    { key: 'projects', title: 'Projects', detail: '81',  icon: 'folder', tone: c.task },
    { key: 'issues',   title: 'Issues',   detail: '167', icon: 'alert',  tone: c.meet },
    { key: 'notes',    title: 'Notes',    detail: '18',  icon: 'file',   tone: c.memo },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      margin: '0 16px',
    }}>
      {cats.map(cat => (
        <div key={cat.key} style={{
          background: c.surface, border: `1px solid ${c.border}`,
          borderRadius: 16, padding: '14px 14px 12px',
          display: 'flex', flexDirection: 'column', gap: 10,
          minHeight: 80,
          boxShadow: c.glassShadow,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: `${cat.tone}1A`, color: cat.tone,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <WW26Icon name={cat.icon} size={16} />
            </div>
            <div style={{
              fontFamily: WW26_MONO, fontSize: 13, fontWeight: 700,
              color: c.textSec, letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums',
            }}>{mode === 'loading' ? '—' : cat.detail}</div>
          </div>
          <div style={{
            fontFamily: WW26_DISPLAY,
            fontSize: 15, fontWeight: 700, color: c.text,
            letterSpacing: '-0.02em',
          }}>{cat.title}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Recent list (v2 — compact, same height as slate rows) ───────────────
const WW26_RECENT = [
  { cat: 'projects', title: 'c-DN',                               stamp: '1h',  accent: 'task' },
  { cat: 'projects', title: 'Pilot 작업의뢰',                       stamp: '3h',  accent: 'task' },
  { cat: 'issues',   title: 'RSM 시스템 구조 I/F 상세설계 불가',     stamp: '1d',  accent: 'meet' },
  { cat: 'people',   title: '권용환',                               stamp: '1d',  accent: 'personal' },
  { cat: 'notes',    title: 'weekly-2026-04-09-to-2026-04-23',     stamp: '2d',  accent: 'daily' },
];

function WW26RecentList({ c, mode }) {
  if (mode === 'empty') {
    return (
      <div style={{
        margin: '0 16px', padding: '20px',
        background: c.surface, border: `1px solid ${c.border}`,
        borderRadius: 18, textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: c.text, marginBottom: 4, fontWeight: 600 }}>
          아직 열어본 문서가 없습니다
        </div>
        <div style={{ fontSize: 11, color: c.textMuted }}>
          검색이나 Wiki에서 열면 여기에 최근 20개가 쌓입니다.
        </div>
      </div>
    );
  }
  return (
    <div style={{
      margin: '0 16px', background: c.surface,
      border: `1px solid ${c.border}`, borderRadius: 18, overflow: 'hidden',
      boxShadow: c.glassShadow,
    }}>
      {WW26_RECENT.map((item, i) => {
        const dot = c[item.accent] || c.accent;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 14px',
            borderBottom: i < WW26_RECENT.length - 1 ? `1px solid ${c.hairline}` : 'none',
            minHeight: 36,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: dot, flexShrink: 0 }} />
            <span style={{
              fontFamily: WW26_MONO, fontSize: 9, fontWeight: 700,
              color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em',
              width: 56, flexShrink: 0,
            }}>{item.cat}</span>
            <div style={{
              fontSize: 13.5, fontWeight: 500, color: c.text,
              flex: 1, minWidth: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              letterSpacing: '-0.015em',
            }}>{item.title}</div>
            <span style={{
              fontSize: 10, color: c.textMuted, fontFamily: WW26_MONO,
              whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
            }}>{item.stamp}</span>
          </div>
        );
      })}
      <div style={{
        padding: '8px 14px', textAlign: 'center',
        fontSize: 12, color: c.accent, fontWeight: 600,
        borderTop: `1px solid ${c.hairline}`, background: c.surfaceAlt,
      }}>더 보기 <span style={{
        fontFamily: WW26_MONO, color: c.textMuted, marginLeft: 4,
        fontVariantNumeric: 'tabular-nums', fontWeight: 700,
      }}>15</span></div>
    </div>
  );
}

// ─── Glass tab bar (floating) ────────────────────────────────────────────
function WW26TabBar({ c, active = 'home', onSelect }) {
  const tabs = [
    { k: 'home',     label: '홈',     icon: 'home' },
    { k: 'calendar', label: '달력',   icon: 'calendar' },
    { k: 'inbox',    label: '보낸 메모', icon: 'inbox' },
    { k: 'settings', label: '설정',   icon: 'settings' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 14, left: 14, right: 14,
      height: 64, zIndex: 40,
      borderRadius: 22,
      ...ww26Glass(c, { level: 2, elevated: true }),
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '0 6px',
      overflow: 'hidden',
    }}>
      <WW26GlassHighlight c={c} radius={22} />
      {tabs.map(t => {
        const on = t.k === active;
        return (
          <button key={t.k} onClick={() => onSelect && onSelect(t.k)} style={{
            flex: 1, height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            color: on ? c.accent : c.textMuted,
            background: 'transparent', border: 'none', cursor: 'pointer',
            position: 'relative',
          }}>
            {on && <span style={{
              position: 'absolute', top: 6,
              width: 4, height: 4, borderRadius: 2,
              background: c.accent,
            }} />}
            <WW26Icon name={t.icon} size={22} sw={on ? 2.1 : 1.85} />
            <div style={{
              fontSize: 10, fontWeight: on ? 700 : 500,
              letterSpacing: '-0.01em',
            }}>{t.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// ─── FAB (glass circle with accent fill) ─────────────────────────────────
function WW26FAB({ c }) {
  return (
    <div style={{
      position: 'absolute', right: 22, bottom: 94, zIndex: 45,
      width: 56, height: 56, borderRadius: 28,
      background: c.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: c.accentTextOn,
      boxShadow: `0 10px 28px ${c.accentFaint}, 0 2px 8px rgba(0,0,0,0.18)`,
    }}>
      <WW26Icon name="pen" size={22} color={c.accentTextOn} sw={2.1} />
    </div>
  );
}

// ─── Offline banner ──────────────────────────────────────────────────────
function WW26OfflineBanner({ c, show }) {
  if (!show) return null;
  return (
    <div style={{ margin: '0 16px 8px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: c.accentSoft,
        border: `1px solid ${c.accentFaint}`,
        borderRadius: 12,
        fontSize: 12, color: c.accent,
      }}>
        <WW26Icon name="cloud-off" size={14} color={c.accent} sw={2} />
        <span>오프라인 · 캐시 버전 표시 중</span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
function HomeView26({
  theme, dark = false, mode = 'normal', offline = false,
  activeSlate = null, onSelectSlate,
  selectedDate = WW_TODAY,
  onSelectDate, onNavigateTab,
  showFollowUp = true,
}) {
  const c = ww26Resolve(theme !== undefined ? theme : (dark ? 'dark' : 'light'));
  const isToday = selectedDate === WW_TODAY;
  const dateSlates = mode === 'empty' ? [] : wwSlatesFor(selectedDate);
  const d = wwParseDate(selectedDate);
  const dowShort = ['일','월','화','수','목','금','토'][d.getDay()];
  const sectionTitle = isToday
    ? `오늘 · ${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${dowShort}`
    : `${d.getMonth() + 1}월 ${d.getDate()}일 ${dowShort}`;

  return (
    <div style={{
      fontFamily: WW26_FONT,
      background: c.bg,
      color: c.text,
      height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      // Background radial wash — different per theme
      <div style={{
        position: 'absolute', inset: 0,
        background: c.theme === 'ant'
          ? `radial-gradient(120% 50% at 50% 0%, ${c.accentSoft}, transparent 60%)`
          : c.theme === 'dark'
            ? `radial-gradient(120% 60% at 50% 0%, ${c.accentSoft}, transparent 70%)`
            : `radial-gradient(120% 60% at 50% 0%, ${c.accentSoft}, transparent 60%)`,
        pointerEvents: 'none',
      }} />

      <div className="ww-scroll" style={{
        flex: 1, overflow: 'auto',
        paddingTop: 56, paddingBottom: 96,
        position: 'relative', zIndex: 1,
      }}>
        <WW26AppBar c={c} mode={mode} />
        <WW26Search c={c} />
        <WW26OfflineBanner c={c} show={offline} />
        {showFollowUp && isToday && mode === 'normal' && !offline && (
          <WW26FollowUpBanner c={c} count={2} />
        )}

        <WW26WeekStrip
          c={c}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          onMonthTap={() => onNavigateTab && onNavigateTab('calendar')}
          onTodayTap={() => onSelectDate && onSelectDate(WW_TODAY)}
        />

        <div style={{ height: 6 }} />
        <WW26Section
          title={sectionTitle}
          detail={mode === 'empty' ? '0 slates' : `${dateSlates.length} slates`}
          c={c}
        />
        {mode === 'empty' || dateSlates.length === 0
          ? <WW26DayEmpty c={c} isToday={isToday} />
          : <WW26TodayCard c={c} mode={mode} slates={dateSlates} activeId={activeSlate} onSelect={onSelectSlate} />}

        <div style={{ height: 22 }} />
        <WW26Section title="최근 열어본 문서" detail={mode === 'empty' ? '0' : '20'} c={c} />
        <WW26RecentList c={c} mode={mode} />

        <div style={{ height: 22 }} />
        <WW26Section title="Wiki" detail="4 categories" c={c} />
        <WW26WikiGrid c={c} mode={mode} />

        <div style={{ height: 30 }} />
      </div>

      <WW26FAB c={c} />
      <WW26TabBar c={c} active="home" onSelect={onNavigateTab} />

      <style>{`
        @keyframes ww26-pulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        .ww-scroll { scrollbar-width: thin; scrollbar-color: ${c.borderStrong} transparent; }
        .ww-scroll::-webkit-scrollbar { width: 3px; height: 3px; }
        .ww-scroll::-webkit-scrollbar-thumb { background: ${c.borderStrong}; border-radius: 3px; }
      `}</style>
    </div>
  );
}

Object.assign(window, {
  HomeView26, WW26Mark, WW26SyncPill, WW26AppBar, WW26Search,
  WW26WeekStrip, WW26Section, WW26SlateRow, WW26TodayCard,
  WW26DayEmpty, WW26WikiGrid, WW26RecentList,
  WW26TabBar, WW26FAB, WW26OfflineBanner, WW26FollowUpBanner,
  WW26_SLATE_KIND,
});
