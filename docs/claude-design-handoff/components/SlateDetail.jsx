// SlateDetail.jsx — Slate detail bottom sheet
// Supports 4 content states based on (hasSlate, hasMD):
//   (true,  true)  — both views render; default MD
//   (true,  false) — slate renders; MD tab disabled (pending)
//   (false, true)  — slate shows "본문 없음"; MD renders; default MD
//   (false, false) — both empty; default slate tab

function CopyIconBtn({ c, onCopy, size = 28 }) {
  return (
    <button
      onClick={onCopy}
      title="클립보드에 복사"
      style={{
        width: size, height: size,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none',
        borderRadius: 6, cursor: 'pointer',
        color: c.textMuted,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="12" height="12" rx="2"/>
        <path d="M5 15V5a2 2 0 0 1 2-2h10"/>
      </svg>
    </button>
  );
}

function SlateDetailSheet({ slate, c, onClose }) {
  if (!slate) return null;
  const meta = SLATE_KIND[slate.kind];
  const dot = c[meta.colorKey];
  const hasSlate = slate.hasSlate !== false;   // default true
  const hasMD = !!slate.md;
  // default tab: MD if available, else slate
  const defaultTab = hasMD ? 'md' : 'slate';
  const [tab, setTab] = React.useState(slate.forceTab || defaultTab);
  const slateId = `slate-${String(240 + (slate.idx || 0)).padStart(4, '0')}`;

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
        }}
      />
      {/* sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 65,
        background: c.surface,
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        borderTop: `1px solid ${c.border}`,
        boxShadow: '0 -16px 40px rgba(0,0,0,0.25)',
        maxHeight: '88%',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* grabber */}
        <div style={{
          padding: '8px 0 4px', display: 'flex', justifyContent: 'center',
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
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
            padding: '3px 8px 3px 7px',
            background: `${dot}1A`, borderRadius: 6,
            fontSize: 11, fontWeight: 700, color: dot,
            letterSpacing: '0.02em',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />
            {meta.label}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: c.textMuted }}>
            2026-04-19 · {slate.time}
          </span>
          <div style={{ flex: 1 }} />
        </div>

        {/* title */}
        <div style={{
          padding: '0 20px 2px',
          fontSize: 19, fontWeight: 700, color: c.text,
          letterSpacing: '-0.02em', lineHeight: 1.3,
        }}>{slate.title}</div>

        {/* slate id + tabs + copy (combined row) */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '2px 14px 10px 20px',
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 11, color: c.textMuted,
            whiteSpace: 'nowrap',
          }}>[[{slateId}]]</span>
          <CopyIconBtn c={c} size={22} onCopy={() => {}} />
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SegTab
              c={c}
              active={tab === 'slate'}
              label="Slate"
              meta={hasSlate ? null : '빈 본문'}
              onClick={() => setTab('slate')}
            />
            <SegTab
              c={c}
              active={tab === 'md'}
              disabled={!hasMD}
              label="MD"
              meta={hasMD ? null : '대기'}
              onClick={() => hasMD && setTab('md')}
            />
          </div>
          <CopyIconBtn c={c} size={26} />
        </div>

        {/* body */}
        <div className="ww-scroll" style={{
          flex: 1, overflowY: 'auto',
          padding: '14px 20px 20px',
          borderTop: `1px solid ${c.border}`,
          background: c.bg,
        }}>
          {tab === 'md' && hasMD && <MDBody slate={slate} c={c} />}
          {tab === 'md' && !hasMD && <MDPending c={c} />}
          {tab === 'slate' && hasSlate && <SlateBody slate={slate} c={c} />}
          {tab === 'slate' && !hasSlate && <SlateEmpty c={c} />}
        </div>

        {/* action bar */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          padding: '10px 16px 18px',
          borderTop: `1px solid ${c.border}`,
          background: c.surface,
        }}>
          <ActionBtn icon="pen" label="편집" c={c} />
          <div style={{ flex: 1 }} />
          <ActionBtn icon="inbox" label="Claude에 묻기" c={c} primary />
        </div>
      </div>
    </>
  );
}

function SegTab({ c, active, disabled, label, meta, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 11px',
        borderRadius: 7,
        border: 'none',
        background: active ? c.accent : 'transparent',
        color: active ? '#fff' : disabled ? c.textMuted : c.textSec,
        opacity: disabled ? 0.55 : 1,
        fontFamily: MONO, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.02em',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
      {meta && (
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700,
          padding: '1px 4px', borderRadius: 3,
          background: active ? 'rgba(255,255,255,0.2)' : c.surfaceAlt,
          color: active ? '#fff' : c.textMuted,
          letterSpacing: '0.02em',
        }}>{meta}</span>
      )}
    </button>
  );
}

function ActionBtn({ icon, label, c, primary }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '9px 14px',
      borderRadius: 10,
      border: primary ? 'none' : `1px solid ${c.border}`,
      background: primary ? c.accent : c.surfaceAlt,
      color: primary ? '#fff' : c.textSec,
      fontFamily: FONT, fontSize: 13, fontWeight: 600,
      letterSpacing: '-0.01em',
      cursor: 'pointer',
      minHeight: 40,
    }}>
      <Icon name={icon} size={15} color={primary ? '#fff' : c.textSec} sw={1.9} />
      {label}
    </button>
  );
}

// ─── Raw slate body (user-written, less structured) ──────────────────────
function SlateBody({ slate, c }) {
  const p = {
    fontSize: 14, lineHeight: 1.75, color: c.textSec,
    margin: '0 0 10px', textWrap: 'pretty',
    whiteSpace: 'pre-wrap',
  };
  const mono = { fontFamily: MONO, fontSize: 12, color: c.text };

  if (slate.kind === 'meeting') {
    return (
      <div>
        <div style={p}>
{`참석: 권용환 남기민 신민우 김태석

- 4/6 담당급 후속
- C4 라이선스 ABAQUS 694 / LS-DYNA 5520
- 남기민 CNS 개발 지원 여부? → 4/22까지 회신
- 권용환 재집계 요청
- 5월 말 target, 7월 오픈

결정: A-2 버전 채택
충방전 효율 +12%`}
        </div>
      </div>
    );
  }
  if (slate.kind === 'task') {
    return (
      <div>
        <div style={p}>
{`RSM I/F 5건
- key값 관리 주체
- 상태값 전달 규약
- Lot 정보 연계
- 의뢰번호 채번·삭제
- 결과 입력 미개발건

63 M/D 중 시스템 I/F 20 M/D 미착수
RSM 구조 미확인 = 블로커

TODO: VW_CDN_PDAT / VW_CDN_PDAT_PR 곽찬호에게 전달`}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={p}>
{`권용환 4/14 회신 자료
ABAQUS 694EA
LS-DYNA 5520EA

현재 부하는 OK
HyperWorks 6종 동시 실행 시 병목?
C4 라이선스 서버 재배치 가능?
Shock 외 15종 우선순위?`}
      </div>
    </div>
  );
}

function SlateEmpty({ c }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '36px 20px', textAlign: 'center',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: c.surfaceAlt, color: c.textMuted,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}>
        <Icon name="pen" size={18} color={c.textMuted} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 4 }}>
        본문 없음
      </div>
      <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.6, maxWidth: 260 }}>
        제목만 있는 슬레이트입니다. 데스크탑에서 본문을 작성하거나{' '}
        마크다운 탭에서 생성된 내용을 확인하세요.
      </div>
    </div>
  );
}

// ─── Rendered markdown body ───────────────────────────────────────────────
function MDBody({ slate, c }) {
  const h = {
    fontSize: 13, fontWeight: 700, color: c.text,
    margin: '14px 0 6px', letterSpacing: '-0.01em',
  };
  const p = {
    fontSize: 14, lineHeight: 1.75, color: c.textSec,
    margin: '0 0 10px', textWrap: 'pretty',
  };
  const li = {
    fontSize: 14, lineHeight: 1.75, color: c.textSec,
    margin: '3px 0',
  };
  const link = {
    color: c.accent, background: c.accentSoft,
    padding: '1px 5px', borderRadius: 4,
    fontWeight: 500, fontSize: 13,
  };
  const mono = { fontFamily: MONO, fontSize: 12 };

  if (slate.kind === 'meeting') {
    return (
      <div>
        <div style={{ ...h, marginTop: 0 }}>참석</div>
        <div style={p}>
          <span style={link}>@권용환</span> <span style={link}>@남기민</span>{' '}
          <span style={link}>@신민우</span> <span style={link}>@김태석</span>
        </div>
        <div style={h}>논의</div>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li style={li}>담당급 회의 후속 — Cloud C4 라이선스 현황 공유</li>
          <li style={li}>저항해석 Toolkit ↔ <span style={link}>[[c-DN]]</span> 연동 지원 여부</li>
          <li style={li}>구조해석 ABAQUS 16코어 / LS-DYNA 64코어 운영 합의</li>
        </ul>
        <div style={h}>결정</div>
        <div style={p}>전극 소재 A-2 채택, 충방전 효율 +12% 확인. 5월 말 Target, 7월 오픈.</div>
        <div style={h}>Action Items</div>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li style={li}><span style={link}>@남기민</span> — CNS 개발 지원 가능 여부 회신 (4/22)</li>
          <li style={li}><span style={link}>@권용환</span> — ABAQUS 라이선스 재집계</li>
        </ul>
      </div>
    );
  }
  if (slate.kind === 'task') {
    return (
      <div>
        <div style={{ ...h, marginTop: 0 }}>배경</div>
        <div style={p}>
          RSM 시스템과의 I/F 설계 중 key값 관리·상태값 전달·Lot 정보 연계 등{' '}
          5개 주요 항목의 협의가 필요한 상황. 총 63 M/D 중 시스템 I/F{' '}
          <span style={mono}>20 M/D</span>가 RSM 구조 미확인으로 상세 설계 미착수.
        </div>
        <div style={h}>체크리스트</div>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <li style={li}>의뢰번호 채번 주체 확정</li>
          <li style={li}>상태값 매핑 테이블 초안</li>
          <li style={li}>VW_CDN_PDAT / VW_CDN_PDAT_PR 전달</li>
        </ul>
        <div style={h}>연결 문서</div>
        <div style={p}>
          <span style={link}>[[c-DN]]</span> · <span style={link}>[[Pilot 작업의뢰]]</span>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div style={p}>
        권용환 책임이 4/14 회신한 구조해석 8종 리소스·라이선스 분석 자료를 읽고
        정리. ABAQUS <span style={mono}>694EA</span> / LS-DYNA{' '}
        <span style={mono}>5,520EA</span> 보유량으로 현재 부하 대응 가능하나,
        HyperWorks 6종 중복 실행 시 병목 우려.
      </div>
      <div style={h}>질문</div>
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <li style={li}>Cloud C4에서 라이선스 서버 재배치가 가능한가?</li>
        <li style={li}>Shock 자동화 외 15종의 우선순위는?</li>
      </ul>
    </div>
  );
}

function MDPending({ c }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '36px 20px', textAlign: 'center',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: c.accentSoft, color: c.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}>
        <Icon name="file" size={20} color={c.accent} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 4 }}>
        마크다운 생성 대기
      </div>
      <div style={{ fontSize: 12, color: c.textMuted, lineHeight: 1.6, maxWidth: 260 }}>
        데스크탑에서 이 슬레이트를 열고 Claude로 마크다운을 생성하면{' '}
        여기에서도 볼 수 있습니다.
      </div>
    </div>
  );
}

Object.assign(window, { SlateDetailSheet });
