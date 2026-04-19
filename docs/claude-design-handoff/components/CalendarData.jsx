// CalendarData.jsx — Shared date utilities + mock data
// (must be loaded BEFORE HomeView/CalendarView/WeekStrip)

// ─── Date utilities (KST naive) ──────────────────────────────────────────
const WW_TODAY = '2026-04-19'; // fixed "today" for mocks

function wwParseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function wwFormatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function wwAddDays(str, delta) {
  const d = wwParseDate(str);
  d.setDate(d.getDate() + delta);
  return wwFormatDate(d);
}
function wwStartOfWeekSun(str) {
  const d = wwParseDate(str);
  d.setDate(d.getDate() - d.getDay()); // 0=Sun
  return wwFormatDate(d);
}
function wwDayOfWeek(str) {
  return wwParseDate(str).getDay();
}
function wwWeekDays(startStr) {
  const arr = [];
  for (let i = 0; i < 7; i++) arr.push(wwAddDays(startStr, i));
  return arr;
}
function wwMonthLabel(str) {
  const d = wwParseDate(str);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}
function wwShortDay(str) {
  const d = wwParseDate(str);
  return ['일','월','화','수','목','금','토'][d.getDay()];
}

// 6×7 = 42 cells for given year/monthIdx(0-based)
function wwBuildMonthCells(year, monthIdx) {
  const firstDay = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const daysInPrev = new Date(year, monthIdx, 0).getDate();
  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const pm = monthIdx === 0 ? 11 : monthIdx - 1;
    const py = monthIdx === 0 ? year - 1 : year;
    cells.push({ day: daysInPrev - i, month: pm, year: py, current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month: monthIdx, year, current: true });
  }
  const nm = monthIdx === 11 ? 0 : monthIdx + 1;
  const ny = monthIdx === 11 ? year + 1 : year;
  let n = 1;
  while (cells.length < 42) cells.push({ day: n++, month: nm, year: ny, current: false });
  return cells.map(c => ({
    ...c,
    dateStr: `${c.year}-${String(c.month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`,
  }));
}

// ─── Mock: slates-per-date (keyed by dateStr) ────────────────────────────
// Only the 'today' (WW_TODAY) key carries the full 10 slates from HomeView.
// Other keys carry partial lists, enough to drive indicators + CalendarView list.
const WW_SLATES_BY_DATE = {
  // previous week
  '2026-04-13': [
    { kind: 'meeting', time: '10:00', title: '월요 주간 킥오프', md: true },
    { kind: 'task',    time: '14:30', title: 'RSM I/F Key 값 정의 v0.2', md: true },
    { kind: 'task',    time: '16:00', title: '의뢰번호 채번 스펙 정리', md: false },
  ],
  '2026-04-14': [
    { kind: 'memo',    time: '09:10', title: '권용환 책임 리소스 회신 읽기', md: true },
    { kind: 'meeting', time: '11:00', title: 'C4 라이선스 재배치 논의', md: true },
    { kind: 'task',    time: '15:20', title: 'ABAQUS 라이선스 재집계', md: true },
    { kind: 'memo',    time: '18:00', title: '스터디 — DataMesh 1장', md: false },
  ],
  '2026-04-15': [
    { kind: 'task',    time: '10:00', title: 'Shock 자동화 우선순위 초안', md: true },
    { kind: 'meeting', time: '14:00', title: 'Cloud 인프라 미팅', md: true },
  ],
  '2026-04-16': [
    { kind: 'meeting', time: '09:00', title: '목요 담당급 정기', md: true },
    { kind: 'task',    time: '11:30', title: 'HyperWorks 병목 조사', md: true },
    { kind: 'personal',time: '13:00', title: '점심 — 최민호 책임', md: false },
    { kind: 'task',    time: '15:40', title: 'VW_CDN_PDAT 뷰 전달', md: true },
    { kind: 'memo',    time: '18:30', title: '주중 회고 메모', md: true },
  ],
  '2026-04-17': [
    { kind: 'task',    time: '10:30', title: '주간 보고 작성 (weekly MD)', md: true },
    { kind: 'meeting', time: '14:00', title: '저항해석 Toolkit 협의', md: true },
    { kind: 'memo',    time: '17:00', title: 'KPI 자기평가 브레인스톰', md: false },
  ],
  '2026-04-18': [
    { kind: 'personal',time: '11:00', title: '주말 할 일', md: false },
  ],
  // today
  '2026-04-19': [
    { kind: 'meeting', time: '09:30', title: '담당급 시뮬레이션 개발 현황 논의', md: true },
    { kind: 'task',    time: '10:40', title: 'RSM I/F 상세설계 검토',          md: true },
    { kind: 'task',    time: '11:15', title: 'Pilot 작업의뢰 63 M/D 확정',     md: true },
    { kind: 'memo',    time: '13:05', title: '권용환 라이선스 분석 읽고 메모', md: false },
    { kind: 'meeting', time: '14:00', title: '저항해석 Toolkit 연계 협의',     md: true },
    { kind: 'personal',time: '15:30', title: 'KPI 자기평가 초안',             md: false },
    { kind: 'task',    time: '16:20', title: 'PDA-T View Table 전달',         md: true },
    { kind: 'memo',    time: '17:10', title: '주간 보고 초안 메모',           md: false },
    { kind: 'meeting', time: '18:00', title: '팀 주간 회의',                   md: false },
    { kind: 'personal',time: '19:40', title: '저녁 회고 메모',                 md: false },
  ],
  // upcoming (this week)
  '2026-04-20': [
    { kind: 'meeting', time: '10:00', title: '월요 주간 킥오프', md: false },
    { kind: 'task',    time: '15:00', title: 'RSM 구조 확인 후속', md: false },
  ],
  '2026-04-22': [
    { kind: 'task',    time: '11:00', title: '남기민 CNS 개발 지원 회신 확인', md: false },
  ],
  '2026-04-24': [
    { kind: 'meeting', time: '14:00', title: '격주 파트너 미팅', md: false },
    { kind: 'memo',    time: '17:00', title: '주간 보고 마감', md: false },
  ],
  // earlier March/April sprinkle
  '2026-04-06': [
    { kind: 'meeting', time: '10:00', title: '4/6 담당급 회의', md: true },
  ],
  '2026-04-07': [
    { kind: 'task', time: '13:00', title: '담당급 후속 정리', md: true },
  ],
  '2026-04-08': [
    { kind: 'memo', time: '09:30', title: '아이디어 기록', md: true },
  ],
  '2026-04-09': [
    { kind: 'task', time: '14:00', title: 'Pilot 스코프 초안', md: true },
  ],
  '2026-04-10': [
    { kind: 'meeting', time: '15:00', title: 'RSM 구조 1차 인터뷰', md: true },
    { kind: 'memo',    time: '18:20', title: '금요일 회고', md: false },
  ],
};

// ─── Mock: follow-up dates ───────────────────────────────────────────────
// Derived from AI items: 4/22 남기민 회신 / 4/24 주보 마감 / 4/16 담당급 follow-up
const WW_FOLLOWUP_DATES = new Set([
  '2026-04-16',
  '2026-04-22',
  '2026-04-24',
  '2026-05-02', // spans across months so we can see on calendar
]);

function wwHasSlate(dateStr) {
  return !!(WW_SLATES_BY_DATE[dateStr] && WW_SLATES_BY_DATE[dateStr].length);
}
function wwHasFollowUp(dateStr) {
  return WW_FOLLOWUP_DATES.has(dateStr);
}
function wwSlatesFor(dateStr) {
  return WW_SLATES_BY_DATE[dateStr] || [];
}

Object.assign(window, {
  WW_TODAY,
  WW_SLATES_BY_DATE, WW_FOLLOWUP_DATES,
  wwParseDate, wwFormatDate, wwAddDays,
  wwStartOfWeekSun, wwDayOfWeek, wwWeekDays,
  wwMonthLabel, wwShortDay, wwBuildMonthCells,
  wwHasSlate, wwHasFollowUp, wwSlatesFor,
});
