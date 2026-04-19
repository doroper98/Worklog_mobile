// WeekStrip.jsx — horizontal Sun–Sat week strip with month label + Today button
// Mirrors Workwiki desktop calendar indicators:
//   • bottom-center blue dot = has slates
//   • top-right red dot      = has follow-up
//   • selected = primary-soft bg, today = primary solid bg

function WeekStrip({
  c,
  selectedDate = WW_TODAY,
  onSelectDate,
  onMonthTap,   // opens CalendarView
  onTodayTap,   // jumps to today
}) {
  const weekStart = wwStartOfWeekSun(selectedDate);
  const days = wwWeekDays(weekStart);
  const isToday = (d) => d === WW_TODAY;
  const dow = ['일','월','화','수','목','금','토'];

  return (
    <div style={{
      padding: '4px 16px 10px',
    }}>
      {/* month label + Today */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 4px 8px',
      }}>
        <button
          onClick={onMonthTap}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 0, color: c.text, font: 'inherit',
          }}
        >
          <span style={{
            fontSize: 15, fontWeight: 700, color: c.text,
            letterSpacing: '-0.02em',
          }}>{wwMonthLabel(selectedDate)}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={c.textMuted} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
        <button
          onClick={onTodayTap}
          disabled={selectedDate === WW_TODAY}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px',
            borderRadius: 6,
            background: selectedDate === WW_TODAY ? c.surfaceAlt : c.accentSoft,
            border: `1px solid ${selectedDate === WW_TODAY ? c.border : c.accentFaint}`,
            color: selectedDate === WW_TODAY ? c.textMuted : c.accent,
            fontFamily: MONO, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            cursor: selectedDate === WW_TODAY ? 'default' : 'pointer',
            opacity: selectedDate === WW_TODAY ? 0.5 : 1,
          }}
        >
          Today
        </button>
      </div>

      {/* 7 day cells */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 2,
      }}>
        {days.map((d, i) => {
          const selected = d === selectedDate;
          const today = isToday(d);
          const hasSlate = wwHasSlate(d);
          const hasFUp = wwHasFollowUp(d);
          const isSun = i === 0;
          const dayNum = Number(d.slice(-2));

          let bg = 'transparent';
          let txt = c.text;
          let labelTxt = c.textMuted;

          if (today && !selected) {
            bg = c.accent;
            txt = '#fff';
            labelTxt = 'rgba(255,255,255,0.8)';
          } else if (selected) {
            bg = c.accentSoft;
            txt = c.accent;
            labelTxt = c.accent;
          } else if (isSun) {
            txt = '#ff3b30';
          }

          return (
            <button
              key={d}
              onClick={() => onSelectDate && onSelectDate(d)}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '6px 0 8px',
                border: 'none', background: 'transparent',
                cursor: 'pointer',
                borderRadius: 10,
              }}
            >
              {/* dow label */}
              <div style={{
                fontFamily: MONO, fontSize: 9, fontWeight: 600,
                color: selected || today ? labelTxt : (isSun ? '#ff3b30' : c.textMuted),
                letterSpacing: '0.02em', marginBottom: 4,
                opacity: selected || today ? 1 : 0.85,
              }}>{dow[i]}</div>

              {/* day circle */}
              <div style={{
                position: 'relative',
                width: 34, height: 34, borderRadius: 17,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: bg,
                fontSize: 15,
                fontWeight: today || selected ? 700 : 500,
                color: txt,
                letterSpacing: '-0.01em',
              }}>
                {dayNum}

                {/* follow-up red dot — top right */}
                {hasFUp && (
                  <span style={{
                    position: 'absolute', top: 1, right: 1,
                    width: 5, height: 5, borderRadius: 3,
                    background: '#ff3b30',
                  }} />
                )}
              </div>

              {/* slate blue dot — below circle */}
              <span style={{
                width: 4, height: 4, borderRadius: 2,
                marginTop: 3,
                background: hasSlate
                  ? (today ? 'rgba(255,255,255,0.85)' : c.accent)
                  : 'transparent',
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { WeekStrip });
