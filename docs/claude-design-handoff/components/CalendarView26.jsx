// CalendarView26.jsx — iOS 26 Liquid Glass calendar tab

function CV26Header({ c, year, monthIdx, onPrev, onNext, onToday, selectedDate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px 10px',
    }}>
      <div style={{
        fontFamily: WW26_DISPLAY,
        fontSize: 24, fontWeight: 700, color: c.text,
        letterSpacing: '-0.025em',
      }}>{year}년 {monthIdx + 1}월</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={onToday}
          disabled={selectedDate === WW_TODAY}
          style={{
            padding: '5px 12px', borderRadius: 999,
            background: selectedDate === WW_TODAY ? c.surfaceAlt : c.accent,
            border: 'none',
            color: selectedDate === WW_TODAY ? c.textMuted : c.accentTextOn,
            fontFamily: WW26_MONO, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            cursor: selectedDate === WW_TODAY ? 'default' : 'pointer',
            opacity: selectedDate === WW_TODAY ? 0.5 : 1,
            marginRight: 4,
          }}
        >Today</button>
        <button onClick={onPrev} style={cv26NavBtn(c)}>
          <WW26Icon name="chev-left" size={15} color={c.textSec} sw={2.2} />
        </button>
        <button onClick={onNext} style={cv26NavBtn(c)}>
          <WW26Icon name="chev-right" size={15} color={c.textSec} sw={2.2} />
        </button>
      </div>
    </div>
  );
}

function cv26NavBtn(c) {
  return {
    width: 32, height: 32,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: 10, cursor: 'pointer',
  };
}

function CV26Grid({ c, year, monthIdx, selectedDate, onSelectDate }) {
  const cells = wwBuildMonthCells(year, monthIdx);
  const dow = ['일','월','화','수','목','금','토'];
  return (
    <div style={{ padding: '0 12px 12px' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        padding: '6px 0 6px',
      }}>
        {dow.map((d, i) => (
          <div key={d} style={{
            fontFamily: WW26_MONO, fontSize: 10, fontWeight: 700,
            color: i === 0 ? c.danger : c.textMuted,
            textAlign: 'center', letterSpacing: '0.04em',
          }}>{d}</div>
        ))}
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        rowGap: 2, columnGap: 0,
      }}>
        {cells.map((cell, i) => (
          <CV26Cell
            key={i} c={c} cell={cell}
            selected={cell.dateStr === selectedDate}
            onClick={() => onSelectDate(cell.dateStr, cell.current)}
          />
        ))}
      </div>
    </div>
  );
}

function CV26Cell({ c, cell, selected, onClick }) {
  const today = cell.dateStr === WW_TODAY;
  const hasSlate = wwHasSlate(cell.dateStr);
  const hasFUp = wwHasFollowUp(cell.dateStr);
  const isSun = wwDayOfWeek(cell.dateStr) === 0;
  const dim = !cell.current;

  let bg = 'transparent';
  let txt = dim ? c.textFaint : (isSun && !today && !selected ? c.danger : c.text);
  let dotBg = c.accent;

  if (today && !selected) {
    bg = c.accent; txt = c.accentTextOn; dotBg = 'rgba(255,255,255,0.85)';
  } else if (selected) {
    bg = c.accentSoft; txt = c.accent; dotBg = c.accent;
  }

  return (
    <button onClick={onClick} style={{
      height: 48, padding: 2,
      border: 'none', background: 'transparent', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'relative',
        width: 36, height: 36, borderRadius: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bg,
        fontSize: 14.5, fontWeight: today || selected ? 700 : 500,
        color: txt,
        opacity: dim ? 0.4 : 1,
        letterSpacing: '-0.01em',
        fontVariantNumeric: 'tabular-nums',
        transition: 'background 0.15s',
      }}>
        {cell.day}
        {hasFUp && !dim && (
          <span style={{
            position: 'absolute', top: 1, right: 1,
            width: 6, height: 6, borderRadius: 3,
            background: today && !selected ? 'rgba(255,255,255,0.95)' : c.danger,
            boxShadow: today && !selected ? 'none' : `0 0 4px ${c.danger}`,
          }} />
        )}
        {hasSlate && !dim && (
          <span style={{
            position: 'absolute', bottom: 2, left: '50%',
            transform: 'translateX(-50%)',
            width: 4, height: 4, borderRadius: 2,
            background: dotBg,
          }} />
        )}
      </div>
    </button>
  );
}

function CV26DayList({ c, selectedDate, onSelectSlate }) {
  const slates = wwSlatesFor(selectedDate);
  const hasFUp = wwHasFollowUp(selectedDate);
  const d = wwParseDate(selectedDate);
  const dowLabel = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][d.getDay()];
  const isToday = selectedDate === WW_TODAY;

  return (
    <div style={{
      flex: 1,
      display: 'flex', flexDirection: 'column',
      minHeight: 0,
      background: c.bg2,
      borderTop: `1px solid ${c.border}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '14px 22px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{
            fontFamily: WW26_DISPLAY,
            fontSize: 17, fontWeight: 700, color: c.text,
            letterSpacing: '-0.02em',
          }}>{d.getMonth() + 1}월 {d.getDate()}일</div>
          <div style={{ fontSize: 12, color: c.textMuted, fontFamily: WW26_MONO }}>
            {dowLabel}{isToday ? ' · 오늘' : ''}
          </div>
          {hasFUp && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: WW26_MONO, fontSize: 9.5, fontWeight: 700,
              color: c.danger, letterSpacing: '0.06em',
              padding: '2px 7px', borderRadius: 999,
              background: `${c.danger}15`,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: c.danger }} />
              FOLLOW-UP
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: c.textMuted, fontFamily: WW26_MONO,
          fontVariantNumeric: 'tabular-nums',
        }}>{slates.length} slates</div>
      </div>
      <div className="ww-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        {slates.length === 0 ? (
          <div style={{
            margin: '12px 0 0', padding: '22px 18px',
            background: c.surface, border: `1px dashed ${c.borderStrong}`,
            borderRadius: 16, textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: c.textSec, marginBottom: 4, fontWeight: 600 }}>
              이 날 슬레이트 없음
            </div>
            <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.55 }}>
              FAB으로 빠른 메모, 데스크탑에서 슬레이트 생성.
            </div>
          </div>
        ) : (
          <div style={{
            background: c.surface, border: `1px solid ${c.border}`,
            borderRadius: 16, overflow: 'hidden',
            boxShadow: c.glassShadow,
          }}>
            {slates.map((s, i) => (
              <WW26SlateRow
                key={i} slate={s} c={c}
                isLast={i === slates.length - 1}
                onClick={() => onSelectSlate && onSelectSlate(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView26({
  theme, dark = false,
  selectedDate = WW_TODAY,
  onSelectDate, onSelectSlate, onNavigateTab,
}) {
  const c = ww26Resolve(theme !== undefined ? theme : (dark ? 'dark' : 'light'));
  const initial = wwParseDate(selectedDate);
  const [viewYear, setViewYear] = React.useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initial.getMonth());

  const prev = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const next = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };
  const goToday = () => {
    const t = wwParseDate(WW_TODAY);
    setViewYear(t.getFullYear()); setViewMonth(t.getMonth());
    onSelectDate && onSelectDate(WW_TODAY);
  };
  const handleCellSelect = (dateStr, isCurrent) => {
    if (!isCurrent) {
      const d = wwParseDate(dateStr);
      setViewYear(d.getFullYear()); setViewMonth(d.getMonth());
    }
    onSelectDate && onSelectDate(dateStr);
  };

  return (
    <div style={{
      fontFamily: WW26_FONT,
      background: c.bg, color: c.text,
      height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(120% 50% at 50% 0%, ${c.accentSoft}, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        paddingTop: 56, paddingBottom: 96,
        minHeight: 0, position: 'relative', zIndex: 1,
      }}>
        <CV26Header
          c={c} year={viewYear} monthIdx={viewMonth}
          onPrev={prev} onNext={next} onToday={goToday}
          selectedDate={selectedDate}
        />
        <CV26Grid
          c={c} year={viewYear} monthIdx={viewMonth}
          selectedDate={selectedDate} onSelectDate={handleCellSelect}
        />
        <CV26DayList c={c} selectedDate={selectedDate} onSelectSlate={onSelectSlate} />
      </div>
      <WW26FAB c={c} />
      <WW26TabBar c={c} active="calendar" onSelect={onNavigateTab} />

      <style>{`
        .ww-scroll { scrollbar-width: thin; scrollbar-color: ${c.borderStrong} transparent; }
        .ww-scroll::-webkit-scrollbar { width: 3px; height: 3px; }
        .ww-scroll::-webkit-scrollbar-thumb { background: ${c.borderStrong}; border-radius: 3px; }
      `}</style>
    </div>
  );
}

Object.assign(window, { CalendarView26 });
