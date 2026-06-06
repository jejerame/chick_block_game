/* global React, GAME */
(function(){
const { useState, useEffect, useMemo, useCallback, useRef } = React;

const { COLS, ROWS, CELL, GAP, GOAL_ROW: DEFAULT_GOAL_ROW, SAVE_TONE, TIER, TIER_THRESHOLD, CATEGORIES, TOP_COLORS, DEFAULT_QUICK_SUBS, FAV_AUTO_PIN, FAV_SUGGEST_COUNT } = window.GAME;

const __R = window.__resources || {};
const CHICK_IMG = {
  save:    __R.chickSave    || "assets/chick_save.png",
  spend:   __R.chickSpend   || "assets/chick_spend.png",
  ghost:   __R.chickGhost   || "assets/chick_ghost.png",
  spendNu: __R.chickSpendNu || "assets/chick_spend_nu.png",
  ghostNu: __R.chickGhostNu || "assets/chick_ghost_nu.png",
  day:     __R.chickDay     || "assets/chick_day.png",
  night:   __R.chickNight   || "assets/chick_night.png",
  goldEgg: __R.goldEgg      || "assets/goldegg_nu.png",
};

const MONTH_SHORT = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function poolBadgeTitle(entry) {
  const m = MONTH_SHORT[entry.month - 1] + "월";
  if (entry.status === "win") return `${m} · 풀 방어 성공`;
  if (entry.status === "fail") return `${m} · 풀에서 블록 ${entry.spawns}회`;
  if (entry.status === "pending") return `${m} · 이번 달 (풀 스폰 ${entry.spawns}회)`;
  if (entry.status === "empty") return `${m} · 기록 없음`;
  return `${m} · 아직`;
}

function poolBadgeDetailMessage(entry, badgeYear) {
  const m = `${badgeYear}년 ${entry.month}월`;
  if (entry.status === "win") return `${m} — 풀 방어 성공! 왕관 계란 획득`;
  if (entry.status === "fail") {
    return `${m} — 풀 블록 ${entry.spawns}회 떨어짐. 다음 달은 여유 있게`;
  }
  if (entry.status === "pending") {
    return entry.spawns === 0
      ? `${m} — 진행 중. 지금까지 풀 블록 0회`
      : `${m} — 이번 달 풀 블록 ${entry.spawns}회 (방어 중)`;
  }
  if (entry.status === "empty") return `${m} — 이 달 거래 기록이 없어요`;
  return `${m} — 아직 오지 않은 달`;
}

const formatKRW = (n) => {
  if (n >= 10000) return Math.round(n / 10000 * 10) / 10 + "만";
  if (n >= 1000) return (n / 1000).toFixed(0) + "천";
  return n.toLocaleString();
};

/** 잔액·초과사용 — 천 단위 콤마 전액 표시 */
const formatWon = (n) => `${Math.max(0, Math.round(n)).toLocaleString("ko-KR")}원`;

/** 우측 TOP3 — 좁은 칸에서도 읽기 쉬운 2줄 분리 (병아리 열은 CSS로 고정) */
const teCatLines = (cat) => {
  const fixed = {
    "데이트비용": ["데이트", "비용"],
    "충동구매": ["충동", "구매"],
    "주택청약": ["주택", "청약"],
  };
  if (fixed[cat]) return fixed[cat];
  if (cat.length <= 4) return [cat];
  if (cat.length <= 6) return [cat.slice(0, 3), cat.slice(3)];
  const mid = Math.ceil(cat.length / 2);
  return [cat.slice(0, mid), cat.slice(mid)];
};

function tone(tier) {
  return tier === "save" ? SAVE_TONE : (TIER[tier] || TIER.cyan);
}

const cellAt = (r, c) => ({
  left: c * (CELL + GAP),
  top:  r * (CELL + GAP),
});

// ── BOARD ──────────────────────────────────────────────────────
function Board({ grid, active, activeCells, ghostCells, ghostMode, pulse, goalRow = DEFAULT_GOAL_ROW, goalBouncing = false, monoFlash = null, hardenRows = [], hardenToast = null }) {
  const W = COLS * CELL + (COLS - 1) * GAP;
  const H = ROWS * CELL + (ROWS - 1) * GAP;
  const outerW = W + 12;
  const outerH = H + 16;
  const fitRef = useRef(null);
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const slot = fitRef.current;
    if (!slot) return;
    const fit = () => {
      const sh = slot.clientHeight;
      const sw = slot.clientWidth;
      if (sh < 8 || sw < 8) return;
      setFitScale(Math.min(1, sh / outerH, sw / outerW));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(slot);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [outerW, outerH]);

  const lockedCells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const d = grid[r][c];
      if (!d) continue;
      lockedCells.push({ r, c, ...d });
    }
  }

  const boardInner = (
    <div className="board" style={{ width: W, height: H }}>
      {/* grid background cells */}
      {Array.from({ length: ROWS }).map((_, r) =>
        Array.from({ length: COLS }).map((_, c) => (
          <div key={`bg-${r}-${c}`} className="cell-bg" style={{ ...cellAt(r,c), width: CELL, height: CELL }} />
        ))
      )}

      {/* goal line */}
      <div
        className={`goal-line ${goalBouncing ? "bouncing" : ""}`}
        style={{ top: goalRow * (CELL + GAP) - 1 }}
      >
        <div className="goal-dashes" />
        <div className="goal-tag">목표 지출선</div>
      </div>

      {/* danger zone shading */}
      <div
        className="danger-zone"
        style={{
          height: Math.max(0, goalRow * (CELL + GAP) - 1),
        }}
      />

      {/* locked cells */}
      {lockedCells.map(({ r, c, kind, tier, mono, subtype, hardened }) => {
        const t = tone(tier);
        const isGhost = ghostMode && kind === "spend" && !hardened;
        // ★ 낱알(mono): subtype 에 따라 흰(기절)/빨강 병아리 얼굴 (목표선 돌파 시 전부 기절)
        let src;
        if (mono) {
          src = isGhost
            ? CHICK_IMG.ghostNu
            : (subtype === "red" ? CHICK_IMG.spendNu : CHICK_IMG.ghostNu);
        } else {
          src = isGhost
            ? CHICK_IMG.ghostNu
            : (kind === "save" ? CHICK_IMG.save : CHICK_IMG.spendNu);
        }
        const popping = monoFlash && monoFlash.r === r && monoFlash.c === c
          && (Date.now() - monoFlash.t) < 700;
        const shaking = hardened && hardenRows.includes(r);
        // ★ 굳은 셀은 회색 콘크리트 색으로 강제
        const cellStyle = hardened
          ? { borderColor: "#6B7280", backgroundColor: "rgba(110, 122, 140, 0.32)" }
          : { borderColor: t.stroke, backgroundColor: t.fill };
        return (
          <div
            key={`lk-${r}-${c}`}
            className={`chick locked ${kind} ${isGhost ? "ghost" : ""} ${mono ? `mono mono-${subtype}` : ""} ${popping ? "mono-pop" : ""} ${hardened ? "hardened" : ""} ${shaking ? "harden-shake" : ""}`}
            style={{
              ...cellAt(r,c),
              width: CELL, height: CELL,
              ...cellStyle,
            }}
          >
            <img src={src} alt="" draggable="false" />
          </div>
        );
      })}

      {/* ghost preview (where active piece will land) */}
      {ghostCells.map(([r, c], i) => {
        const t = tone(active.tier);
        return (
          <div key={`gh-${i}`} className="cell-ghost" style={{
            ...cellAt(r,c), width: CELL, height: CELL,
            borderColor: t.stroke,
          }} />
        );
      })}

      {/* active piece */}
      {activeCells.map(([r, c], i) => {
        const t = tone(active.tier);
        return (
          <div
            key={`act-${i}`}
            className={`chick active ${pulse ? "pulse" : ""}`}
            style={{
              ...cellAt(r,c),
              width: CELL, height: CELL,
              borderColor: t.stroke,
              backgroundColor: t.fill,
            }}
          >
            <img
              src={active.kind === "save" ? CHICK_IMG.save : CHICK_IMG.spendNu}
              alt=""
              draggable="false"
            />
          </div>
        );
      })}

      {/* ★ 굳음 안내 토스트 */}
      {hardenToast && (
        <div className="harden-toast" key={hardenToast.t}>
          🪨 이 줄은 <b>굳었어요</b> · 지출은 지울 수 없어요
        </div>
      )}
    </div>
  );

  return (
    <div className="board-fit-slot board-grid-host" ref={fitRef}>
      <div
        className="board-scale-wrap"
        style={{
          width: outerW,
          height: outerH,
          transform: `scale(${fitScale})`,
        }}
      >
        {boardInner}
      </div>
    </div>
  );
}

function LandingStartButton({ onStart }) {
  const btnRef = useRef(null);
  const touchRef = useRef(false);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const onTouchEnd = (e) => {
      e.stopPropagation();
      touchRef.current = true;
      onStart();
      window.setTimeout(() => { touchRef.current = false; }, 500);
    };
    const onClick = (e) => {
      e.stopPropagation();
      if (touchRef.current) return;
      onStart();
    };
    el.addEventListener("touchend", onTouchEnd, false);
    el.addEventListener("click", onClick, false);
    return () => {
      el.removeEventListener("touchend", onTouchEnd, false);
      el.removeEventListener("click", onClick, false);
    };
  }, [onStart]);

  return (
    <button
      ref={btnRef}
      type="button"
      className="landing-start"
      aria-label="시작하기"
    >
      시작하기 <span className="landing-start-arrow" aria-hidden="true">→</span>
    </button>
  );
}

function LandingCopy() {
  return (
    <>
      <div className="landing-brand">
        <img src={CHICK_IMG.save} alt="" className="landing-logo" draggable="false" />
        <span className="landing-brand-name">병아리 블록 가계부</span>
      </div>
      <div className="landing-pills" aria-hidden="true">
        <span className="landing-pill income">수입</span>
        <span className="landing-pill spend">지출</span>
        <span className="landing-pill save">저축</span>
      </div>
      <h1 id="landing-title" className="landing-title">쓴 돈은 블록이 되어<br/>쌓입니다</h1>
      <p className="landing-hook">
        자잘한 지출이 공중에서 합쳐져 떨어지고,<br/>
        저축은 내 손으로 의식적으로 쌓는 가계부.
      </p>
    </>
  );
}

// ── LANDING — 안정 버전 + 연출 슬롯(캡처 위·카피 아래) ──
function Landing({ onStart, closing }) {
  const FxOverlay = window.LandingFxOverlay;

  return (
    <div
      className={`landing landing--simple ${closing ? "closing" : ""}`}
      role="region"
      aria-label="시작 화면"
      aria-labelledby="landing-title"
    >
      {/* ① 뒤: 실제 앱(히어로 보드) 블러 */}
      <div className="landing-backdrop-blur" aria-hidden="true" />

      {/* ② 캡처가 보이는 영역 — 뒤 보드 + 가운데만 살짝 선명 */}
      <div className="landing-capture-zone" aria-hidden="true" />

      {/* ③ 연출 슬롯 — landing-fx-overlay.jsx 의 LandingFxOverlay */}
      <div className="landing-fx-slot" data-landing-fx-slot>
        {typeof FxOverlay === "function" ? <FxOverlay /> : null}
      </div>

      {/* ④ 글래스 텍스트 (backdrop-filter — iOS 터치 이슈로 버튼은 밖에 둠) */}
      <div className="landing-copy-anchor">
        <div className="landing-content landing-content--panel">
          <LandingCopy />
        </div>
      </div>

      {/* ⑤ 시작하기 — 글래스 밖·최상단 z-index (Safari 탭 보장) */}
      <div className="landing-start-slot">
        <LandingStartButton onStart={onStart} />
      </div>
    </div>
  );
}

// ── THEME MASCOT (밤 → 낮 → 숲 3단 순환) ──────────────────────
/** 연간 풀 방어 트로피 — 홈(compact) / 통계(card) 공용 */
function YearBadgeStrip({
  badgeYear,
  months,
  winCount,
  variant = "compact",
  badgeViewYear,
  badgeYears,
  onBadgeViewYearChange,
}) {
  const isCard = variant === "card";
  const [detailToast, setDetailToast] = useState(null);
  const viewYear = badgeViewYear != null ? badgeViewYear : badgeYear;
  const years = badgeYears && badgeYears.length ? badgeYears : [viewYear];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const canPrev = viewYear > minYear;
  const canNext = viewYear < maxYear;

  useEffect(() => {
    if (!detailToast) return undefined;
    const t = setTimeout(() => setDetailToast(null), 2800);
    return () => clearTimeout(t);
  }, [detailToast]);

  const onSlotTap = (entry) => {
    if (entry.status === "future") return;
    setDetailToast({
      status: entry.status,
      text: poolBadgeDetailMessage(entry, badgeYear),
    });
  };

  const yearNav = onBadgeViewYearChange ? (
    <div className="pt-year-nav">
      <button
        type="button"
        className="pt-year-btn"
        disabled={!canPrev}
        onClick={() => onBadgeViewYearChange(viewYear - 1)}
        aria-label="이전 해"
      >
        ‹
      </button>
      <span className="pt-year-val">{viewYear}</span>
      <button
        type="button"
        className="pt-year-btn"
        disabled={!canNext}
        onClick={() => onBadgeViewYearChange(viewYear + 1)}
        aria-label="다음 해"
      >
        ›
      </button>
    </div>
  ) : null;

  const grid = (
    <div className={`pt-grid ${isCard ? "pt-grid--card" : "pt-grid--compact"}`}>
      {months.map((entry) => (
        <button
          type="button"
          key={entry.ym}
          className={`pt-slot pt-slot--${entry.status}`}
          title={poolBadgeTitle(entry)}
          disabled={entry.status === "future"}
          onClick={() => onSlotTap(entry)}
        >
          {entry.status === "win" && (
            <img className="pt-gold-egg" src={CHICK_IMG.goldEgg} alt="" draggable={false} />
          )}
          {isCard && (
            <span className="pt-slot-mo">{MONTH_SHORT[entry.month - 1]}</span>
          )}
        </button>
      ))}
    </div>
  );

  const toast = detailToast ? (
    <div className={`pt-detail-toast pt-detail-toast--${detailToast.status}`} role="status">
      {detailToast.text}
    </div>
  ) : null;

  if (isCard) {
    return (
      <div className="pool-trophy-card screen-section">
        <div className="pt-card-title-block">
          <div className="pt-card-mission-label">미션성공</div>
          <div className="pt-card-year-line">
            {yearNav || <span className="pt-card-year">{badgeYear}</span>}
          </div>
        </div>
        {grid}
        <p className="pt-card-hint">
          이번 달 자잘지출 풀 한도 안에서 버티면 황금 계란 획득! 풀이 꽉 차면 그 달은 게임 오버.
          칸을 탭하면 그달 기록을 볼 수 있어요.
        </p>
        {toast}
      </div>
    );
  }

  return (
    <div className="pool-trophy-compact" aria-label={`${badgeYear}년 미션 성공 ${winCount}개월`}>
      <div className="pt-compact-head">
        <div className="pt-compact-title-block">
          <div className="pt-compact-label">미션성공</div>
          <div className="pt-compact-year-line">
            {yearNav || <span className="pt-compact-year">{badgeYear}</span>}
          </div>
        </div>
      </div>
      {grid}
      {toast}
    </div>
  );
}

function ThemeMascot({ theme, onToggle }) {
  const isNight = theme === "dark";
  const label    = theme === "dark" ? "NIGHT" : "DAY";
  const stateTxt = theme === "dark" ? "현재 밤 모드" : "현재 낮 모드";
  const nextName = theme === "dark" ? "낮" : "밤";
  return (
    <button
      className={`theme-mascot ${isNight ? "is-night" : ""} theme-${theme}`}
      onClick={onToggle}
      aria-label={`${nextName} 모드로 전환`}
      title={`탭하면 ${nextName} 모드로`}
    >
      <div className="tm-chick">
        <img className="tm-img-day"   src={CHICK_IMG.day}   alt="" draggable="false" />
        <img className="tm-img-night" src={CHICK_IMG.night} alt="" draggable="false" />
      </div>
      <div className="tm-label">{label}</div>
      <div className="tm-state">{stateTxt}</div>
    </button>
  );
}

// ── LEFT PANEL: EGG CARTON ─────────────────────────────────────
function EggCartonPanel({
  eggs, goal, savePct, theme, onToggleTheme, poolBadges,
  badgeViewYear, badgeYears, onBadgeViewYearChange,
}) {
  const rows = 6, cols = 3;
  const total = rows * cols;
  return (
    <div className="side-panel egg-panel">
      <div className="side-eyebrow">SAVE</div>
      <div className="side-title">계란판<br/>적금</div>

      <div className="carton">
        <div className="carton-inner">
          {Array.from({ length: total }, (_, i) => {
            const filled = i < eggs;
            return (
              <div key={i} className="egg-slot">
                <div className="egg-dimple" />
                {filled && (
                  <div className="egg">
                    <div className="egg-shine" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="side-stat">
        <div className="side-stat-num">
          <span className="big">{savePct}</span>
          <span className="mid">%</span>
        </div>
        <div className="side-stat-cap">수입 대비 저축</div>
      </div>

      <div className="side-bar">
        <div className="side-bar-fill save" style={{ width: `${savePct}%` }} />
      </div>
      <div className="side-foot">
        <span>{eggs}/{goal}알</span>
        <span className="streak">🔥 12일</span>
      </div>

      <ThemeMascot theme={theme} onToggle={onToggleTheme} />
      {poolBadges && (
        <YearBadgeStrip
          badgeYear={poolBadges.year}
          months={poolBadges.months}
          winCount={poolBadges.winCount}
          variant="compact"
          badgeViewYear={badgeViewYear}
          badgeYears={badgeYears}
          onBadgeViewYearChange={onBadgeViewYearChange}
        />
      )}
    </div>
  );
}

// ── RIGHT PANEL: ANGER ROOM + TOP EXPENSES ─────────────────────
function AngerRoomPanel({ angerPct, topExpenses, onOpenList, balance = 0, overSpend = 0 }) {
  // simulate bubbling chicks count
  const bubbles = Math.min(5, Math.ceil(angerPct / 22));
  return (
    <div className="side-panel anger-panel">
      <div className="side-eyebrow danger">RAGE</div>
      <div className="side-title">분노의<br/>방</div>

      <div className="kettle">
        <div className="kettle-glass">
          <div className="kettle-fill" style={{ height: `${angerPct}%` }}>
            <div className="kettle-fill-shine" />
            {/* boiling chicks */}
            <div className="kettle-chicks">
              {Array.from({ length: bubbles }).map((_, i) => (
                <img
                  key={i}
                  src={CHICK_IMG.spendNu}
                  alt=""
                  className={`bubble-chick bc${i}`}
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
          {/* steam bubbles */}
          <div className="steam s1" />
          <div className="steam s2" />
          <div className="steam s3" />
          {/* measure marks */}
          {[25, 50, 75].map((p) => (
            <div key={p} className="kettle-mark" style={{ bottom: `${p}%` }}>
              <span>{p}</span>
            </div>
          ))}
          {/* danger cap */}
          <div className="kettle-cap" />
        </div>
      </div>

      <div className="side-stat">
        <div className="side-stat-num">
          <span className="big danger">{angerPct}</span>
          <span className="mid">%</span>
        </div>
        <div className="side-stat-cap">분노 게이지</div>
      </div>

      <div className="top-exp-mini">
        <div className="top-exp-head">지출 TOP 3</div>
        {topExpenses.map((t, i) => {
          const tier = tone(t.tier);
          return (
            <div key={i} className="te-row">
              <div className="te-rank" style={{ background: tier.fill, color: tier.stroke, borderColor: tier.stroke }}>
                {i + 1}
              </div>
              <div className="te-body">
                <div className="te-cat">
                  {teCatLines(t.cat).map((line, j) => (
                    <span key={j} className="te-cat-line">{line}</span>
                  ))}
                </div>
                <div className="te-amt">{formatKRW(t.amount)}</div>
              </div>
              <img src={CHICK_IMG.spendNu} alt="" className="te-chick" />
            </div>
          );
        })}
        <button className="te-open-list" onClick={onOpenList}>
          <img src={CHICK_IMG.save} alt="" className="te-open-chick" />
          <span className="te-open-text">
            <span className="te-open-line">항목보기</span>
            <span className="te-open-line">/수정</span>
          </span>
          <span className="te-open-arrow">→</span>
        </button>
        <div className="te-cash-summary" aria-label="잔액 및 초과사용">
          <div className="te-cash-row">
            <span className="te-cash-label">잔액:</span>
            <span className="te-cash-val num">{formatWon(balance)}</span>
          </div>
          <div className="te-cash-row">
            <span className="te-cash-label">초과사용:</span>
            <span className="te-cash-val num">{formatWon(overSpend)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TOP HEADER ─────────────────────────────────────────────────
function AppHeader({ income, gaugeIncome, expense, saving, ghostMode, onChipTap }) {
  const pctBase = gaugeIncome > 0 ? gaugeIncome : income;
  const expPct = pctBase > 0 ? Math.round(expense / pctBase * 100) : 0;
  const savPct = pctBase > 0 ? Math.round(saving / pctBase * 100) : 0;
  return (
    <div className="app-header">
      <div className="header-row1">
        <div className="brand">
          <div className="brand-logo">
            <img src={CHICK_IMG.save} alt="" />
          </div>
          <div className="brand-text">
            <div className="brand-name">병아리 블록 가계부</div>
            <div className="brand-sub">5월 26일 · DAY 26/31</div>
          </div>
        </div>
        <div className={`life-badge ${ghostMode ? "danger" : ""}`}>
          <span className="dot" />
          <span>{ghostMode ? "위험" : "안전"}</span>
        </div>
      </div>

      <div className="stat-strip">
        <button className="stat-chip income tappable" onClick={() => onChipTap?.("income")}>
          <div className="chip-label">수입 <span className="chip-tap-hint">+</span></div>
          <div className="chip-val">{formatKRW(income)}</div>
          <div className="chip-unit">원</div>
        </button>
        <button className="stat-chip spend tappable" onClick={() => onChipTap?.("spend")}>
          <div className="chip-label">지출 <span className="chip-pct">{expPct}%</span> <span className="chip-tap-hint">+</span></div>
          <div className="chip-val">{formatKRW(expense)}</div>
          <div className="chip-unit">원</div>
        </button>
        <button className="stat-chip save tappable" onClick={() => onChipTap?.("save")}>
          <div className="chip-label">저축 <span className="chip-pct">{savPct}%</span> <span className="chip-tap-hint">+</span></div>
          <div className="chip-val">{formatKRW(saving)}</div>
          <div className="chip-unit">원</div>
        </button>
      </div>
    </div>
  );
}

// ── BOTTOM CONTROLS ────────────────────────────────────────────
function Controls({ active, pool, nextThreshold, onRotate, onMoveLeft, onMoveRight, onDrop, onRescue, rescueAvailable }) {
  const t = active ? tone(active.tier) : tone("cyan");
  const isSave = active?.kind === "save";

  const renderPreview = (piece, big = false) => {
    const SHAPES = window.GAME.SHAPES;
    const shape = SHAPES[piece.shape][piece.rot || 0];
    const rs = shape.map((s) => s[0]);
    const cs = shape.map((s) => s[1]);
    const minR = Math.min(...rs), minC = Math.min(...cs);
    const h = Math.max(...rs) - minR + 1;
    const w = Math.max(...cs) - minC + 1;
    const px = big ? 12 : 9;
    return (
      <div className="piece-preview" style={{
        width: w * px + (w - 1) * 1,
        height: h * px + (h - 1) * 1,
      }}>
        {shape.map(([r, c], i) => {
          const tt = tone(piece.tier);
          return (
            <div key={i} className="pp-cell" style={{
              left: (c - minC) * (px + 1),
              top:  (r - minR) * (px + 1),
              width: px, height: px,
              borderColor: tt.stroke,
              backgroundColor: tt.fill,
            }}>
              <img src={piece.kind === "save" ? CHICK_IMG.save : CHICK_IMG.spendNu} alt="" />
            </div>
          );
        })}
      </div>
    );
  };

  const nextT = tone(nextThreshold.tier);
  const remain = Math.max(0, nextThreshold.value - pool);

  return (
    <div className={`controls ${active ? "has-active" : ""}`}>
      {/* Active piece info — 활성 블록이 있을 때만 표시 (없을 땐 상단 PoolZone이 풀 상태 알림) */}
      {active && (
        <div className={`active-card ${isSave ? "save-place" : "falling"}`} style={{
          borderColor: t.stroke,
          background: `linear-gradient(180deg, ${t.fill}, rgba(255,255,255,0.02))`,
        }}>
          <div className="ac-left">
            {renderPreview(active, true)}
          </div>
          <div className="ac-mid">
            <div className="ac-label">{active.label}</div>
            <div className="ac-amount">
              <span className="ac-num">{active.amount.toLocaleString()}</span>
              <span className="ac-unit">원</span>
            </div>
            <div className="ac-tier" style={{ color: t.stroke }}>
              ● {isSave ? "저축" : TIER[active.tier]?.label}
              <span className="ac-falling">
                {isSave ? " · 의식적으로 끼워 넣기" : " · 자동 낙하 중"}
              </span>
            </div>
          </div>
          {!isSave && (
            <div className="ac-right">
              <button className="btn rotate-big" onClick={onRotate} aria-label="rotate">
                <svg width="18" height="18" viewBox="0 0 16 16">
                  <path d="M3.5 5.5A5 5 0 1 1 3 9.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                  <path d="M1 4l3-.5L3.5 6.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>회전</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SIM 버튼 제거됨 — 이제 상단 칩 탭 → 바텀시트 입력으로 통합 */}

      <div className={`ctrl-row ${isSave ? "save-mode" : ""}`}>
        {isSave && (
          <div className="dpad">
            <button type="button" className="btn arrow" onClick={onMoveLeft} aria-label="left">←</button>
            <button type="button" className="btn arrow rotate" onClick={onRotate} aria-label="rotate">↻</button>
            <button type="button" className="btn arrow" onClick={onMoveRight} aria-label="right">→</button>
            <button
              type="button"
              className="btn drop dpad-drop"
              onClick={onDrop}
              onTouchEnd={(e) => { e.preventDefault(); onDrop(); }}
            >
              <span className="drop-glyph">▼</span>
              <span>DROP</span>
            </button>
          </div>
        )}
        {active && !isSave && (
          <button
            type="button"
            className="btn drop wide"
            onClick={onDrop}
            onTouchEnd={(e) => { e.preventDefault(); onDrop(); }}
          >
            <span className="drop-glyph">▼</span>
            <span>DROP</span>
          </button>
        )}

        <button
          type="button"
          className={`btn rescue ${rescueAvailable <= 0 ? "disabled" : ""} ${!active ? "solo" : ""}`}
          onClick={onRescue}
          disabled={rescueAvailable <= 0}
          aria-label="rescue"
        >
          <img src={CHICK_IMG.save} alt="" />
          <div className="rescue-text">
            <span className="rescue-title">저축 보상</span>
            <span className="rescue-sub">{rescueAvailable}회 · 한 줄 삭제</span>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── POOL ZONE (공중 부양 합산 풀) ──────────────────────────────
function PoolZone({ pool, nextThreshold, toast }) {
  // 5천 원당 하나의 fragment, 최대 12개
  const fragCount = Math.min(12, Math.max(0, Math.floor(pool / 5_000)));
  const nextT = tone(nextThreshold.tier);
  const progress = Math.min(100, Math.round(pool / nextThreshold.value * 100));

  // fragment 위치 — 결정론적이지만 약간 흩어진 느낌
  const frags = Array.from({ length: fragCount }).map((_, i) => {
    const x = ((i * 37) % 100);
    const y = ((i * 53) % 100);
    const d = (i * 0.27) % 2.4;
    return { x, y, d };
  });

  return (
    <div className="pool-zone">
      <div className="pool-header">
        <span className="pool-eyebrow">공중 부양 풀</span>
        <span className="pool-amt">{pool.toLocaleString()}원</span>
      </div>
      <div className="pool-cloud">
        {frags.map((f, i) => (
          <div
            key={i}
            className="pool-frag"
            style={{
              left: `${f.x}%`,
              top: `${f.y}%`,
              animationDelay: `${f.d}s`,
              borderColor: nextT.stroke,
              backgroundColor: nextT.fill,
            }}
          >
            <img src={CHICK_IMG.spendNu} alt="" />
          </div>
        ))}
        {toast && (
          <div className={`pool-toast tier-${toast.tier}`} key={toast.t}>
            <b>{TIER[toast.tier]?.label || "큰결제"}</b> 블록 실체화 → 낙하!
          </div>
        )}
      </div>
      <div className="pool-progress">
        <div className="pool-pbar">
          <div className="pool-pfill" style={{
            width: `${progress}%`,
            background: nextT.stroke,
          }} />
        </div>
        <div className="pool-pcap">
          다음 <b style={{ color: nextT.stroke }}>{TIER[nextThreshold.tier]?.label}</b> 까지
          <span className="num"> {Math.max(0, nextThreshold.value - pool).toLocaleString()}</span>원
        </div>
      </div>
    </div>
  );
}

// ── 도움말 (? 버튼 + 팝업) ─────────────────────────────────────
function HelpTip({ title, items, align = "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`help-tip-wrap align-${align}`}>
      <button
        type="button"
        className="help-tip-btn"
        aria-label={`${title} 도움말`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open && (
        <>
          <button
            type="button"
            className="help-tip-scrim"
            aria-label="도움말 닫기"
            onClick={() => setOpen(false)}
          />
          <div className="help-tip-popover" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="help-tip-head">
              <span className="help-tip-title">{title}</span>
              <button type="button" className="help-tip-close" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
            </div>
            <ul className="help-tip-list">
              {items.map((item, i) => (
                <li key={i}>
                  {item.strong && <b>{item.strong}</b>}
                  {item.strong && " — "}
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </span>
  );
}

const HELP_FAVORITES = [
  { strong: "탭", text: "금액·카테고리가 채워지고 잠시 후 자동으로 확정돼요." },
  { strong: "길게 누르기", text: "이름·금액 수정, 삭제 메뉴가 열려요." },
  { strong: "📌", text: `${FAV_AUTO_PIN}번 이상 쓰면 자동으로 고정 표시돼요.` },
];

const HELP_TRANSACTION_LIST = [
  { strong: "행 탭", text: "금액·카테고리를 수정할 수 있어요." },
  { strong: "밀기", text: "왼쪽으로 밀면 삭제 버튼이 나와요." },
  { strong: "삭제", text: "수정 화면 맨 아래 🗑️에서도 삭제할 수 있어요." },
];

const FAV_DISMISS_KEY = "chick.favSuggestDismiss";
const LONG_PRESS_MS = 550;
const SWIPE_DELETE_W = 76;
const FINE_POINTER_MQ = "(hover: hover) and (pointer: fine)";

function useFinePointer() {
  const [fine, setFine] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(FINE_POINTER_MQ).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(FINE_POINTER_MQ);
    const apply = () => setFine(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return fine;
}

const favSuggestSig = (type, amount, sub) => `${type}|${amount}|${sub}`;

const loadFavDismissed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_DISMISS_KEY) || "[]"));
  } catch (_) {
    return new Set();
  }
};

const saveFavDismissed = (sig) => {
  const s = loadFavDismissed();
  s.add(sig);
  try { localStorage.setItem(FAV_DISMISS_KEY, JSON.stringify([...s])); } catch (_) {}
};

// ── BOTTOM SHEET (입력 모달) ───────────────────────────────────
const TYPE_META = {
  spend:  { title: "지출 추가", color: "#FFA7AF" },
  income: { title: "수입 추가", color: "#B7C9FF" },
  save:   { title: "저축 추가", color: "#FFE899" },
};

const DOW_SHORT = ["일", "월", "화", "수", "목", "금", "토"];

const todayISO = () => new Date().toISOString().slice(0, 10);

const addDaysISO = (iso, delta) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

const formatDateLabel = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW_SHORT[d.getDay()]})`;
};

const formatDatePill = (iso) => {
  const label = formatDateLabel(iso);
  return iso === todayISO() ? `오늘 · ${label}` : label;
};

const buildQuickDateStrip = () => {
  const t = todayISO();
  return [-3, -2, -1, 0, 1, 2, 3].map((off) => {
    const iso = addDaysISO(t, off);
    const d = new Date(iso + "T12:00:00");
    return { iso, isToday: off === 0, dow: DOW_SHORT[d.getDay()], dayNum: d.getDate() };
  });
};

function BottomSheet({ type, favorites, transactions, onClose, onSubmit, onUpdateFavorite, onDeleteFavorite, editing, onDelete }) {
  const [amount, setAmount] = useState(editing ? editing.amount : 0);
  const [picked, setPicked] = useState(editing ? { top: editing.categoryTop, sub: editing.categorySub } : null);
  const [showFull, setShowFull] = useState(false);
  const [pickedTop, setPickedTop] = useState(editing ? editing.categoryTop : null);
  const [saveAsFav, setSaveAsFav] = useState(false);
  const [showFavSuggest, setShowFavSuggest] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoConfirmFav, setAutoConfirmFav] = useState(null);
  const [usedFavoriteId, setUsedFavoriteId] = useState(null);
  const [favMenu, setFavMenu] = useState(null);
  const [favEditId, setFavEditId] = useState(null);
  const [favEditLabel, setFavEditLabel] = useState("");
  const [selectedDate, setSelectedDate] = useState(editing?.date || todayISO());
  const [dateExpanded, setDateExpanded] = useState(false);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);
  const favAutoTimer = useRef(null);
  const meta = TYPE_META[type];
  const favScrollRef = useRef(null);
  const catScrollRef = useRef(null);
  const dateScrollRef = useRef(null);
  const datePickerRef = useRef(null);
  const quickDates = useMemo(() => buildQuickDateStrip(), []);
  // 양쪽 스크롤 가능 여부 (화살표 표시 조건)
  const [favCanL, setFavCanL] = useState(false);
  const [favCanR, setFavCanR] = useState(false);

  useEffect(() => {
    setSelectedDate(editing?.date || todayISO());
    setDateExpanded(false);
    setUsedFavoriteId(null);
    setSaveAsFav(false);
    setShowFavSuggest(false);
    setFavMenu(null);
    setFavEditId(null);
    return () => {
      if (favAutoTimer.current) clearTimeout(favAutoTimer.current);
      favAutoTimer.current = null;
    };
  }, [editing?.id, type]);

  // 같은 금액·카테고리를 N회 이상 직접 입력했으면 즐겨찾기 토글 자동 추천
  useEffect(() => {
    if (editing || usedFavoriteId || favEditId) {
      setShowFavSuggest(false);
      return;
    }
    if (!amount || !picked || picked.sub === "기타") {
      setShowFavSuggest(false);
      return;
    }
    const sig = favSuggestSig(type, amount, picked.sub);
    if (loadFavDismissed().has(sig)) {
      setShowFavSuggest(false);
      return;
    }
    const exists = favorites.some(
      (f) => f.type === type && f.amount === amount && f.categorySub === picked.sub
    );
    if (exists) {
      setShowFavSuggest(false);
      return;
    }
    const count = (transactions || []).filter(
      (t) => t.type === type && t.amount === amount && t.categorySub === picked.sub
    ).length;
    if (count >= FAV_SUGGEST_COUNT) {
      setSaveAsFav(true);
      setShowFavSuggest(true);
    } else {
      setShowFavSuggest(false);
    }
  }, [amount, picked, type, favorites, transactions, editing, usedFavoriteId, favEditId]);

  // PC에서 가로 스크롤 지원: 마우스 휠(세로) → 가로 이동 + 드래그 이동
  useEffect(() => {
    const wireUp = (el) => {
      if (!el) return () => {};
      const onWheel = (e) => {
        // 세로 휠을 가로 스크롤로 변환 (가로 휠은 그대로)
        const dy = e.deltaY;
        const dx = e.deltaX;
        if (Math.abs(dy) > Math.abs(dx)) {
          el.scrollLeft += dy;
          e.preventDefault();
        }
      };
      let isDown = false, startX = 0, startScroll = 0;
      const onDown = (e) => {
        // 버튼이나 인터랙티브 요소 위에서 시작한 클릭은 무시 (탭 동작 살리기)
        if (e.target.closest("button")) return;
        isDown = true;
        startX = e.clientX;
        startScroll = el.scrollLeft;
        el.style.cursor = "grabbing";
      };
      const onMove = (e) => {
        if (!isDown) return;
        el.scrollLeft = startScroll - (e.clientX - startX);
      };
      const onUp = () => { isDown = false; el.style.cursor = "grab"; };
      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      el.style.cursor = "grab";
      return () => {
        el.removeEventListener("wheel", onWheel);
        el.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    };
    const c1 = wireUp(favScrollRef.current);
    const c2 = wireUp(catScrollRef.current);
    const c3 = wireUp(dateScrollRef.current);
    return () => { c1(); c2(); c3(); };
  }, [showFull, dateExpanded]);

  useEffect(() => {
    if (!dateExpanded) return;
    const el = dateScrollRef.current?.querySelector(".date-day-chip.on");
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [dateExpanded, selectedDate]);

  // 즐겨찾기 영역 스크롤 위치 추적 — 양쪽 화살표 표시 여부
  useEffect(() => {
    const el = favScrollRef.current;
    if (!el) return;
    const check = () => {
      setFavCanL(el.scrollLeft > 4);
      setFavCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    };
    check();
    const t = setTimeout(check, 60); // 마운트 직후 정확 측정용
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(t);
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [favorites.length, type]);

  const scrollFav = (dir) => {
    const el = favScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: "smooth" });
  };

  const myFavs = useMemo(
    () => favorites
      .filter((f) => f.type === type)
      .sort((a, b) => b.usageCount - a.usageCount),
    [favorites, type]
  );

  const quickSubs = DEFAULT_QUICK_SUBS[type] || [];
  const cats = CATEGORIES[type] || {};
  const topList = Object.keys(cats);

  const press = (n) => {
    setUsedFavoriteId(null);
    if (n === "⌫") setAmount(Math.floor(amount / 10));
    else if (n === "00") setAmount(amount * 100 <= 99_999_999 ? amount * 100 : amount);
    else setAmount(amount * 10 + n <= 99_999_999 ? amount * 10 + n : amount);
  };

  const cancelFavAutoConfirm = () => {
    if (favAutoTimer.current) clearTimeout(favAutoTimer.current);
    favAutoTimer.current = null;
    setAutoConfirmFav(null);
  };

  const confirm = () => {
    if (favEditId) {
      saveFavEdit();
      return;
    }
    if (amount <= 0) return;
    const sub = picked?.sub || "기타";
    const top = picked?.top || (type === "spend" ? "생활" : (type === "income" ? "수입" : "저축"));
    onSubmit({
      type,
      amount,
      date: selectedDate,
      categoryTop: top,
      categorySub: sub,
      saveAsFav: saveAsFav && sub !== "기타", // "기타"는 즐겨찾기 저장 의미 없음
    });
  };

  const pickFavorite = (f) => {
    if (longPressFired.current || favEditId || favMenu) return;
    cancelFavAutoConfirm();
    setUsedFavoriteId(f.id);
    setSaveAsFav(false);
    setShowFavSuggest(false);
    setAmount(f.amount);
    setPicked({ top: f.categoryTop, sub: f.categorySub });
    setAutoConfirmFav(f.id);
    favAutoTimer.current = setTimeout(() => {
      favAutoTimer.current = null;
      setAutoConfirmFav(null);
      onSubmit({
        type,
        amount: f.amount,
        date: selectedDate,
        categoryTop: f.categoryTop,
        categorySub: f.categorySub,
        fromFavorite: f.id,
      });
    }, 380);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const bindFavLongPress = (f) => ({
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      longPressFired.current = false;
      clearLongPress();
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        cancelFavAutoConfirm();
        setFavMenu(f);
        setFavEditId(null);
      }, LONG_PRESS_MS);
    },
    onPointerUp: clearLongPress,
    onPointerLeave: clearLongPress,
    onPointerCancel: clearLongPress,
  });

  const startFavEdit = (f) => {
    cancelFavAutoConfirm();
    setFavMenu(null);
    setFavEditId(f.id);
    setFavEditLabel(f.label);
    setAmount(f.amount);
    setPicked({ top: f.categoryTop, sub: f.categorySub });
    setUsedFavoriteId(null);
    setSaveAsFav(false);
    setShowFavSuggest(false);
  };

  const saveFavEdit = () => {
    if (!favEditId || !favEditLabel.trim()) return;
    onUpdateFavorite?.({
      id: favEditId,
      label: favEditLabel.trim(),
      amount,
      categoryTop: picked?.top,
      categorySub: picked?.sub,
    });
    setFavEditId(null);
    setFavEditLabel("");
  };

  const dismissFavSuggest = () => {
    if (amount && picked?.sub) saveFavDismissed(favSuggestSig(type, amount, picked.sub));
    setSaveAsFav(false);
    setShowFavSuggest(false);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`bottom-sheet type-${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-body">
        <div className="sheet-head">
          <div className="sheet-title" style={{ color: meta.color }}>
            {editing ? `${meta.title.replace("추가", "수정")}` : meta.title}
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="close">✕</button>
        </div>

        {editing && (
          <div className="edit-banner">
            <span>📝 원본:</span>
            <b>{editing.date}</b> · {editing.amount.toLocaleString()}원 · {editing.categorySub}
          </div>
        )}

        {/* favorites (편집 모드에선 숨김) */}
        {!editing && (
        <div className="fav-row">
          <div className="fav-label">
            <span>★ 즐겨찾기</span>
            <HelpTip title="즐겨찾기" items={HELP_FAVORITES} align="left" />
          </div>
          <div className="fav-scroll" ref={favScrollRef}>
            {myFavs.map((f) => {
              const dotColor = TOP_COLORS[f.categoryTop] || meta.color;
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`fav-chip ${autoConfirmFav === f.id ? "picked" : ""}`}
                  style={{ borderColor: meta.color }}
                  disabled={!!favEditId}
                  onClick={(e) => {
                    if (longPressFired.current) {
                      e.preventDefault();
                      longPressFired.current = false;
                      return;
                    }
                    pickFavorite(f);
                  }}
                  {...bindFavLongPress(f)}
                >
                  <span className="fav-dot" style={{ background: dotColor }} />
                  <span className="fav-name">{f.label}</span>
                  <span className="fav-amt">{f.amount.toLocaleString()}</span>
                  {f.usageCount >= FAV_AUTO_PIN && <span className="fav-pin">📌</span>}
                </button>
              );
            })}
            <button className="fav-chip fav-add" style={{ borderColor: meta.color, color: meta.color }}>
              +
            </button>
          </div>
          {favCanL && (
            <button
              className="fav-scroll-arrow left"
              aria-label="이전"
              onClick={() => scrollFav(-1)}
            >‹</button>
          )}
          {favCanR && (
            <button
              className="fav-scroll-arrow right"
              aria-label="다음"
              onClick={() => scrollFav(1)}
            >›</button>
          )}
        </div>
        )}

        {showFavSuggest && picked && amount > 0 && !usedFavoriteId && (
          <div className="fav-suggest-banner">
            <span>
              ★ <b>{picked.sub} {amount.toLocaleString()}원</b>을 자주 쓰시네요 · 즐겨찾기에 저장할까요?
            </span>
            <button type="button" className="fav-suggest-dismiss" onClick={dismissFavSuggest}>무시</button>
          </div>
        )}

        {favEditId && (
          <div className="fav-edit-mode-banner">
            ✏️ 즐겨찾기만 수정 중 · 거래는 등록되지 않아요
          </div>
        )}

        {favEditId && (
          <div className="fav-edit-bar">
            <span className="feb-label">즐겨찾기 이름</span>
            <input
              className="feb-input"
              value={favEditLabel}
              onChange={(e) => setFavEditLabel(e.target.value)}
              placeholder="이름"
            />
            <button type="button" className="feb-save" style={{ background: meta.color }} onClick={saveFavEdit}>저장</button>
            <button type="button" className="feb-cancel" onClick={() => { setFavEditId(null); setFavEditLabel(""); }}>취소</button>
          </div>
        )}

        {/* amount display */}
        <div className="sheet-amount" style={{ color: meta.color }}>
          <span className="amt-num">{amount ? amount.toLocaleString() : "0"}</span>
          <span className="amt-unit">원</span>
        </div>

        {/* category — 빠른 칩 또는 더보기 풀 피커 */}
        {!showFull ? (
          <div className="cat-row" ref={catScrollRef}>
            {quickSubs.map((qc) => {
              const isActive = picked && picked.top === qc.top && picked.sub === qc.sub;
              const dot = TOP_COLORS[qc.top];
              return (
                <button
                  key={`${qc.top}-${qc.sub}`}
                  className={`cat-chip ${isActive ? "active" : ""}`}
                  style={isActive ? { borderColor: meta.color, color: meta.color, background: `${meta.color}18` } : {}}
                  onClick={() => { setPicked(qc); setUsedFavoriteId(null); }}
                  title={qc.top}
                >
                  <span className="cat-dot" style={{ background: dot }} />
                  {qc.sub}
                </button>
              );
            })}
            {type === "spend" && (
              <button className="cat-chip cat-more" onClick={() => { setShowFull(true); setPickedTop(picked?.top || topList[0]); }}>
                더보기 ▾
              </button>
            )}
          </div>
        ) : (
          <div className="cat-full">
            <div className="cat-full-head">
              <button className="cat-back" onClick={() => setShowFull(false)}>← 빠른 칩</button>
              {picked && <span className="cat-current">선택: <b style={{ color: TOP_COLORS[picked.top] }}>● {picked.top}</b> · {picked.sub}</span>}
            </div>
            <div className="cat-top-grid">
              {topList.map((t) => (
                <button
                  key={t}
                  className={`cat-top-chip ${pickedTop === t ? "active" : ""}`}
                  style={pickedTop === t ? { borderColor: TOP_COLORS[t], background: `${TOP_COLORS[t]}22` } : {}}
                  onClick={() => setPickedTop(t)}
                >
                  <span className="cat-dot" style={{ background: TOP_COLORS[t] }} />
                  {t}
                </button>
              ))}
            </div>
            <div className="cat-sub-row">
              {(cats[pickedTop] || []).filter((s) => s !== "기타").map((s) => {
                const isActive = picked && picked.top === pickedTop && picked.sub === s;
                return (
                  <button
                    key={s}
                    className={`cat-sub-chip ${isActive ? "active" : ""}`}
                    style={isActive ? { borderColor: TOP_COLORS[pickedTop], color: TOP_COLORS[pickedTop] } : {}}
                    onClick={() => { setPicked({ top: pickedTop, sub: s }); setShowFull(false); setUsedFavoriteId(null); }}
                  >
                    {s}
                  </button>
                );
              })}
              <button
                className="cat-sub-chip cat-sub-etc"
                onClick={() => { setPicked({ top: pickedTop, sub: "기타" }); setShowFull(false); setUsedFavoriteId(null); }}
              >기타</button>
            </div>
          </div>
        )}

        {/* date — 7일 인라인 펼침 + 다른 날짜 */}
        <div className={`date-row ${dateExpanded ? "expanded" : ""}`}>
          <button
            type="button"
            className={`date-pill ${dateExpanded ? "open" : ""}`}
            onClick={() => setDateExpanded((v) => !v)}
          >
            <span>📅 {formatDatePill(selectedDate)}</span>
            <span className="date-chev">▾</span>
          </button>
          <input
            ref={datePickerRef}
            type="date"
            className="date-picker-hidden"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setDateExpanded(false);
            }}
          />
          {dateExpanded && (
            <div className="date-strip-wrap">
              <div className="date-strip" ref={dateScrollRef}>
                {quickDates.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    className={`date-day-chip ${selectedDate === d.iso ? "on" : ""} ${d.isToday ? "today" : ""}`}
                    onClick={() => {
                      setSelectedDate(d.iso);
                      setDateExpanded(false);
                    }}
                  >
                    <span className="ddc-dow">{d.isToday ? "오늘" : d.dow}</span>
                    <span className="ddc-num">{d.dayNum}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="date-day-chip date-other"
                  onClick={() => {
                    const inp = datePickerRef.current;
                    if (!inp) return;
                    if (typeof inp.showPicker === "function") inp.showPicker();
                    else inp.click();
                  }}
                >
                  <span className="ddc-dow">···</span>
                  <span className="ddc-num">다른</span>
                  <span className="ddc-sub">날짜</span>
                </button>
              </div>
            </div>
          )}
        </div>
        </div>{/* /.sheet-body */}

        <div className="sheet-footer">
        {/* number pad */}
        <div className="numpad">
          {[1,2,3,4,5,6,7,8,9].map((n) => (
            <button key={n} className="np-btn" onClick={() => press(n)}>{n}</button>
          ))}
          <button className="np-btn np-aux" onClick={() => press("00")}>00</button>
          <button className="np-btn" onClick={() => press(0)}>0</button>
          <button className="np-btn np-aux" onClick={() => press("⌫")}>⌫</button>
        </div>

        {/* 즐겨찾기 저장 토글 — 확인 버튼 위 (즐겨찾기 칩 입력·편집 중엔 숨김) */}
        {!editing && !usedFavoriteId && !favEditId && (
        <button
          className={`save-fav-toggle ${saveAsFav ? "on" : ""}`}
          onClick={() => { setSaveAsFav(!saveAsFav); if (saveAsFav) setShowFavSuggest(false); }}
          disabled={!picked || picked.sub === "기타"}
        >
          <span className="sft-star">{saveAsFav ? "★" : "☆"}</span>
          <span className="sft-text">
            {saveAsFav
              ? <>즐겨찾기에 <b>저장됨</b> · 다음에 1탭으로 입력</>
              : <>다음에도 빠르게 입력 · <b>즐겨찾기에 저장</b></>}
          </span>
        </button>
        )}

        <button
          className="confirm-btn"
          style={{ background: meta.color, color: "#0B1130" }}
          onClick={confirm}
          disabled={amount <= 0 || (favEditId && !favEditLabel.trim())}
        >
          {favEditId
            ? (amount > 0 && favEditLabel.trim()
              ? `★ ${favEditLabel.trim()} · ${amount.toLocaleString()}원 즐겨찾기 저장`
              : "이름과 금액을 입력하세요")
            : amount > 0
              ? `${amount.toLocaleString()}원 · ${picked ? picked.sub : "카테고리 선택"} ${editing ? "수정 저장" : "추가"}`
              : "금액을 입력하세요"}
        </button>

        {/* 편집 모드: 삭제 버튼 */}
        {editing && (
          <button
            className={`delete-btn ${confirmDelete ? "confirm" : ""}`}
            onClick={() => {
              if (confirmDelete) onDelete?.(editing.id);
              else setConfirmDelete(true);
            }}
          >
            {confirmDelete
              ? <>⚠️ 한 번 더 눌러 삭제 확정</>
              : <>🗑️ 이 거래 삭제</>}
          </button>
        )}
        </div>{/* /.sheet-footer */}

        {favMenu && (
          <div className="fav-menu-backdrop" onClick={() => setFavMenu(null)}>
            <div className="fav-menu" onClick={(e) => e.stopPropagation()}>
              <div className="fav-menu-title">
                <b>{favMenu.label}</b>
                <span className="fav-menu-amt">{favMenu.amount.toLocaleString()}원</span>
              </div>
              <button type="button" className="fav-menu-btn" onClick={() => startFavEdit(favMenu)}>✏️ 이름·금액 수정</button>
              <button
                type="button"
                className="fav-menu-btn danger"
                onClick={() => { onDeleteFavorite?.(favMenu.id); setFavMenu(null); }}
              >🗑️ 즐겨찾기 삭제</button>
              <button type="button" className="fav-menu-btn muted" onClick={() => setFavMenu(null)}>닫기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SwipeableListRow({ onEdit, onDelete, accentColor, children }) {
  const isFinePointer = useFinePointer();
  const [offset, setOffset] = useState(0);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const drag = useRef({ active: false, startX: 0, startOff: 0 });
  const innerRef = useRef(null);

  const clamp = (v) => Math.max(-SWIPE_DELETE_W, Math.min(0, v));

  const onPointerDown = (e) => {
    if (isFinePointer) return;
    if (e.target.closest("button.list-row-delete-btn, button.list-row-pc-del")) return;
    drag.current = { active: true, startX: e.clientX, startOff: offset };
    innerRef.current?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    setOffset(clamp(drag.current.startOff + (e.clientX - drag.current.startX)));
  };
  const endDrag = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setOffset((o) => (o < -38 ? -SWIPE_DELETE_W : 0));
    setDeleteArmed(false);
  };

  const handleRowClick = () => {
    if (offset < -8) {
      setOffset(0);
      return;
    }
    onEdit();
  };

  const handleDelete = () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    onDelete();
    setOffset(0);
    setDeleteArmed(false);
  };

  const handlePcDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("이 항목을 삭제할까요?")) {
      onDelete();
      setOffset(0);
      setDeleteArmed(false);
    }
  };

  return (
    <div className={`list-row-swipe${isFinePointer ? " list-row-swipe--fine" : ""}`}>
      {!isFinePointer && (
        <button
          type="button"
          className={`list-row-delete-btn ${deleteArmed ? "armed" : ""}`}
          style={{ width: SWIPE_DELETE_W, color: accentColor }}
          onClick={handleDelete}
        >
          {deleteArmed ? "확정" : "삭제"}
        </button>
      )}
      <div
        ref={innerRef}
        className="list-row-inner"
        style={isFinePointer ? undefined : { transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={isFinePointer ? undefined : onPointerMove}
        onPointerUp={isFinePointer ? undefined : endDrag}
        onPointerCancel={isFinePointer ? undefined : endDrag}
      >
        <button type="button" className="list-row" onClick={handleRowClick}>
          {children}
        </button>
        {isFinePointer && (
          <button
            type="button"
            className="list-row-pc-del"
            aria-label="삭제"
            onClick={handlePcDelete}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

function BottomNav({ ghostMode, screen, onSelect }) {
  const items = [
    { id: "home",   label: "홈",     icon: "▦" },
    { id: "stats",  label: "통계",   icon: "▤" },
    { id: "me",     label: "내 정보", icon: "◐" },
  ];
  return (
    <div className="bottom-nav">
      {items.map((it) => (
        <button
          key={it.id}
          className={`nav-item ${screen === it.id ? "active" : ""}`}
          onClick={() => onSelect?.(it.id)}
        >
          <span className="nav-icon">{it.icon}</span>
          <span className="nav-label">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── TRANSACTION LIST SHEET (전체 거래 보기/수정) ────────────────
function TransactionListSheet({ transactions, onClose, onEdit, onDelete }) {
  const [filter, setFilter] = useState("spend"); // "spend" | "income" | "save"
  const FILTERS = [
    { id: "spend",  label: "지출", color: "#FFA7AF" },
    { id: "income", label: "수입", color: "#B7C9FF" },
    { id: "save",   label: "저축", color: "#FFE899" },
  ];

  const filtered = transactions
    .filter((t) => t.type === filter)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));

  // 날짜별 그룹
  const groups = [];
  filtered.forEach((t) => {
    const last = groups[groups.length - 1];
    if (last && last.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  });

  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const filterMeta = FILTERS.find((f) => f.id === filter);

  return (
    <div className="sheet-backdrop list-backdrop" onClick={onClose}>
      <div className="list-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="list-head">
          <div className="list-title-row">
            <div className="list-title">항목 보기/수정</div>
            <HelpTip title="항목 목록" items={HELP_TRANSACTION_LIST} align="left" />
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="close">✕</button>
        </div>

        {/* 필터 탭 */}
        <div className="list-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`list-tab ${filter === f.id ? "active" : ""}`}
              style={filter === f.id ? { color: f.color, borderColor: f.color } : {}}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="list-tab-count">
                {transactions.filter((t) => t.type === f.id).length}
              </span>
            </button>
          ))}
        </div>

        {/* 총합 */}
        <div className="list-total" style={{ color: filterMeta.color }}>
          <span className="lt-label">{filterMeta.label} 총합</span>
          <span className="lt-num">{total.toLocaleString()}</span>
          <span className="lt-unit">원</span>
        </div>

        {/* 리스트 */}
        <div className="list-body">
          {groups.length === 0 ? (
            <div className="list-empty">
              <img src={CHICK_IMG.ghostNu} alt="" />
              <div>이 분류에 거래가 없어요</div>
            </div>
          ) : groups.map((g) => (
            <div key={g.date} className="list-day">
              <div className="list-day-head">{formatDateLabel(g.date)}</div>
              <div className="list-rows">
                {g.items.map((t) => {
                  const dot = TOP_COLORS[t.categoryTop] || "#999";
                  return (
                    <SwipeableListRow
                      key={t.id}
                      accentColor={filterMeta.color}
                      onEdit={() => onEdit(t)}
                      onDelete={() => onDelete(t.id)}
                    >
                      <span className="lr-dot" style={{ background: dot }} />
                      <div className="lr-mid">
                        <div className="lr-sub">{t.categorySub}</div>
                        <div className="lr-top">{t.categoryTop}</div>
                      </div>
                      <div className="lr-amt" style={{ color: filterMeta.color }}>
                        {filter === "spend" ? "-" : "+"}{t.amount.toLocaleString()}
                      </div>
                      <span className="lr-chev">›</span>
                    </SwipeableListRow>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
Object.assign(window, {
  Board, EggCartonPanel, AngerRoomPanel, AppHeader, Controls, BottomNav, PoolZone, BottomSheet,
  TransactionListSheet, ThemeMascot, YearBadgeStrip, Landing,
});
})();
