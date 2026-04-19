// CalendarView.jsx — full-screen calendar tab
// Top: month grid (6×7) with Workwiki indicators
// Bottom: selected-date slate list (iOS-Calendar style)

function CalHeader({ c, year, monthIdx, onPrev, onNext, onToday, selectedDate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px 8px',
    }}>
      <div style={{
        fontSize: 22, fontWeight: 700, color: c.text,
        letterSpacing: '-0.02em',
      }}>
        {year}년 {monthIdx + 1}월
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={onToday}
          disabled={selectedDate === WW_TODAY}
          style={{
            padding: '5px 10px',
            marginRight: 6,
            borderRadius: 6,
            background: selectedDate === WW_TODAY ? c.surfaceAlt : c.accentSoft,
            border: `1px solid ${selectedDate === WW_TODAY ? c.border : c.accentFaint}`,
            color: selectedDate === WW_TODAY ? c.textMuted : c.accent,
            fontFamily: MONO, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            cursor: selectedDate === WW_TODAY ? 'default' : 'pointer',
            opacity: selectedDate === WW_TODAY ? 0.5 : 1,
          }}
        >Today</button>
        <button onClick={onPrev} style={calNavBtnStyle(c)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button onClick={onNext} style={calNavBtnStyle(c)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}

function calNavBtnStyle(c) {
  return {
    width: 28, height: 28,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: c.surface, border: `1px solid ${c.border}`,
    borderRadius: 6, cursor: 'pointer', color: c.textSec,
  };
}

function CalGrid({ c, year, monthIdx, selectedDate, onSelectDate }) {
  const cells = wwBuildMonthCells(year, monthIdx);
  const dow = ['일','월','화','수','목','금','토'];
  return (
    <div style={{ padding: '0 14px 10px' }}>
      {/* weekday header */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        padding: '6px 0 4px',
      }}>
        {dow.map((d, i) => (
          <div key={d} style={{
            fontFamily: MONO, fontSize: 10, fontWeight: 600,
            color: i === 0 ? '#ff3b30' : c.textMuted,
            textAlign: 'center', letterSpacing: '0.04em',
          }}>{d}</div>
        ))}
      </div>

      {/* 42 cells */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        rowGap: 2, columnGap: 0,
      }}>
        {cells.map((cell, i) => (
          <CalCell
            key={i}
            c={c}
            cell={cell}
            selected={cell.dateStr === selectedDate}
            onClick={() => onSelectDate(cell.dateStr, cell.current, cell.month)}
          />
        ))}
      </div>
    </div>
  );
}

function CalCell({ c, cell, selected, onClick }) {
  const today = cell.dateStr === WW_TODAY;
  const hasSlate = wwHasSlate(cell.dateStr);
  const hasFUp = wwHasFollowUp(cell.dateStr);
  const isSun = wwDayOfWeek(cell.dateStr) === 0;
  const dim = !cell.current;

  let bg = 'transparent';
  let txt = dim ? c.textMuted : (isSun && !today && !selected ? '#ff3b30' : c.text);
  let dotBg = c.accent;
  if (today && !selected) {
    bg = c.accent;
    txt = '#fff';
    dotBg = 'rgba(255,255,255,0.85)';
  } else if (selected) {
    bg = c.accentSoft;
    txt = c.accent;
    dotBg = c.accent;
  }

  return (
    <button
      onClick={onClick}
      style={{
        height: 44,
        padding: 2,
        border: 'none', background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        position: 'relative',
        width: 34, height: 34, borderRadius: 17,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: bg,
        fontSize: 14, fontWeight: today || selected ? 700 : 500,
        color: txt,
        opacity: dim ? 0.35 : 1,
        letterSpacing: '-0.01em',
      }}>
        {cell.day}

        {/* follow-up red dot — top right */}
        {hasFUp && !dim && (
          <span style={{
            position: 'absolute', top: 1, right: 1,
            width: 5, height: 5, borderRadius: 3,
            background: '#ff3b30',
          }} />
        )}

        {/* slate blue dot — bottom center */}
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

// ─── Bottom list: selected-date slates (shares SlateRow visuals) ─────────
function CalDayList({ c, selectedDate, onSelectSlate }) {
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
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '12px 20px 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: c.text,
            letterSpacing: '-0.01em',
          }}>{d.getMonth() + 1}월 {d.getDate()}일</div>
          <div style={{
            fontSize: 12, color: c.textMuted, fontFamily: MONO,
          }}>{dowLabel}{isToday ? ' · 오늘' : ''}</div>
          {hasFUp && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              color: '#ff3b30', letterSpacing: '0.02em',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: '#ff3b30' }} />
              FOLLOW-UP
            </span>
          )}
        </div>
        <div style={{
          fontSize: 11, color: c.textMuted, fontFamily: MONO,
        }}>{slates.length} slates</div>
      </div>

      {/* list */}
      <div className="ww-scroll" style={{
        flex: 1, overflowY: 'auto', padding: '0 16px 16px',
      }}>
        {slates.length === 0 ? (
          <div style={{
            margin: '12px 0 0',
            padding: '22px 18px',
            background: c.surface, border: `1px dashed ${c.borderStrong}`,
            borderRadius: 12,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: c.textSec, marginBottom: 4 }}>
              이 날 슬레이트 없음
            </div>
            <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.55 }}>
              FAB으로 빠른 메모를 남기거나, 데스크탑에서 슬레이트를 생성하세요.
            </div>
          </div>
        ) : (
          <div style={{
            background: c.surface, border: `1px solid ${c.border}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            {slates.map((s, i) => (
              <SlateRow
                key={i}
                slate={s}
                c={c}
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

// ─── Main CalendarView ───────────────────────────────────────────────────
function CalendarView({
  dark = false,
  selectedDate = WW_TODAY,
  onSelectDate,       // (dateStr) => void
  onSelectSlate,      // (slateIdx in selected date) => void
}) {
  const c = { ...(dark ? WW_COLORS.dark : WW_COLORS.light), dark };
  const initial = wwParseDate(selectedDate);
  const [viewYear, setViewYear] = React.useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(initial.getMonth());

  const prev = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const next = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => {
    const t = wwParseDate(WW_TODAY);
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    onSelectDate && onSelectDate(WW_TODAY);
  };

  const handleCellSelect = (dateStr, isCurrent, cellMonth) => {
    // if user taps a dim cell from adjacent month, shift view
    if (!isCurrent) {
      const d = wwParseDate(dateStr);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    onSelectDate && onSelectDate(dateStr);
  };

  return (
    <div style={{
      fontFamily: FONT,
      background: c.bg,
      color: c.text,
      height: '100%',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* scroll area */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        paddingTop: 56, paddingBottom: 88,
        minHeight: 0,
      }}>
        <CalHeader
          c={c}
          year={viewYear}
          monthIdx={viewMonth}
          onPrev={prev}
          onNext={next}
          onToday={goToday}
          selectedDate={selectedDate}
        />
        <CalGrid
          c={c}
          year={viewYear}
          monthIdx={viewMonth}
          selectedDate={selectedDate}
          onSelectDate={handleCellSelect}
        />
        <CalDayList
          c={c}
          selectedDate={selectedDate}
          onSelectSlate={onSelectSlate}
        />
      </div>

      <FAB c={c} />
      <TabBar c={c} active="calendar" />

      <style>{`
        .ww-scroll { scrollbar-width: thin; scrollbar-color: ${c.borderStrong} transparent; }
        .ww-scroll::-webkit-scrollbar { width: 3px; height: 3px; background: transparent; }
        .ww-scroll::-webkit-scrollbar-thumb { background: ${c.borderStrong}; border-radius: 3px; }
      `}</style>
    </div>
  );
}

Object.assign(window, { CalendarView });
