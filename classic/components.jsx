/* global React, GAME */
(function(){
const { useState, useEffect, useMemo, useCallback, useRef } = React;

const { COLS, ROWS, CELL, GAP, GOAL_ROW: DEFAULT_GOAL_ROW, SAVE_TONE, TIER, TIER_THRESHOLD, CATEGORIES, TOP_COLORS, DEFAULT_QUICK_SUBS } = window.GAME;

const __R = window.__resources || {};
const CHICK_IMG = {
  save:    __R.chickSave    || "assets/chick_save.png",
  spend:   __R.chickSpend   || "assets/chick_spend.png",
  ghost:   __R.chickGhost   || "assets/chick_ghost.png",
  spendNu: __R.chickSpendNu || "assets/chick_spend_nu.png",
  ghostNu: __R.chickGhostNu || "assets/chick_ghost_nu.png",
  day:     __R.chickDay     || "assets/chick_day.png",
  night:   __R.chickNight   || "assets/chick_night.png",
};

const formatKRW = (n) => {
  if (n >= 10000) return Math.round(n / 10000 * 10) / 10 + "만";
  if (n >= 1000) return (n / 1000).toFixed(0) + "천";
  return n.toLocaleString();
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

  const lockedCells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const d = grid[r][c];
      if (!d) continue;
      lockedCells.push({ r, c, ...d });
    }
  }

  return (
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
        const isGhost = ghostMode && kind !== "ghost" && !hardened;
        // ★ 낱알(mono): subtype 에 따라 흰(기절)/빨강 병아리 얼굴
        let src;
        if (mono) {
          src = subtype === "red" ? CHICK_IMG.spendNu : CHICK_IMG.ghostNu;
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
            <img src={CHICK_IMG.spendNu} alt="" draggable="false" />
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
}

// ── THEME MASCOT (낮/밤 토글) ──────────────────────────────────
function ThemeMascot({ theme, onToggle }) {
  const isNight = theme === "dark";
  return (
    <button
      className={`theme-mascot ${isNight ? "is-night" : ""}`}
      onClick={onToggle}
      aria-label={isNight ? "낮 모드로 전환" : "밤 모드로 전환"}
      title={isNight ? "낮 모드로 전환" : "밤 모드로 전환"}
    >
      <div className="tm-chick">
        <img className="tm-img-day"   src={CHICK_IMG.day}   alt="" draggable="false" />
        <img className="tm-img-night" src={CHICK_IMG.night} alt="" draggable="false" />
      </div>
      <div className="tm-label">{isNight ? "NIGHT" : "DAY"}</div>
      <div className="tm-state">{isNight ? "현재 밤 모드" : "현재 낮 모드"}</div>
    </button>
  );
}

// ── LEFT PANEL: EGG CARTON ─────────────────────────────────────
function EggCartonPanel({ eggs, goal, savePct, theme, onToggleTheme }) {
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
    </div>
  );
}

// ── RIGHT PANEL: ANGER ROOM + TOP EXPENSES ─────────────────────
function AngerRoomPanel({ angerPct, topExpenses, onOpenList }) {
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
                <div className="te-cat">{t.cat}</div>
                <div className="te-amt">{formatKRW(t.amount)}</div>
              </div>
              <img src={CHICK_IMG.spendNu} alt="" className="te-chick" />
            </div>
          );
        })}
        <button className="te-open-list" onClick={onOpenList}>
          <img src={CHICK_IMG.save} alt="" className="te-open-chick" />
          <span className="te-open-text">항목 보기/수정</span>
          <span className="te-open-arrow">→</span>
        </button>
      </div>
    </div>
  );
}

// ── TOP HEADER ─────────────────────────────────────────────────
function AppHeader({ income, expense, saving, ghostMode, onChipTap }) {
  const expPct = Math.round(expense / income * 100);
  const savPct = Math.round(saving / income * 100);
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
function Controls({ active, pool, nextThreshold, onRotate, onDrop, onRescue, rescueAvailable }) {
  const t = active ? tone(active.tier) : tone("cyan");

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
              <img src={CHICK_IMG.spendNu} alt="" />
            </div>
          );
        })}
      </div>
    );
  };

  const nextT = tone(nextThreshold.tier);
  const remain = Math.max(0, nextThreshold.value - pool);

  return (
    <div className="controls">
      {/* Active piece info — 활성 블록이 있을 때만 표시 (없을 땐 상단 PoolZone이 풀 상태 알림) */}
      {active && (
        <div className="active-card falling" style={{
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
              ● {TIER[active.tier]?.label} <span className="ac-falling">· 자동 낙하 중</span>
            </div>
          </div>
          <div className="ac-right">
            <button className="btn rotate-big" onClick={onRotate} aria-label="rotate">
              <svg width="18" height="18" viewBox="0 0 16 16">
                <path d="M3.5 5.5A5 5 0 1 1 3 9.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                <path d="M1 4l3-.5L3.5 6.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>회전</span>
            </button>
          </div>
        </div>
      )}

      {/* SIM 버튼 제거됨 — 이제 상단 칩 탭 → 바텀시트 입력으로 통합 */}

      <div className="ctrl-row">
        {active && (
          <button className="btn drop wide" onClick={onDrop}>
            <span className="drop-glyph">▼</span>
            <span>DROP</span>
          </button>
        )}

        <button
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

// ── BOTTOM SHEET (입력 모달) ───────────────────────────────────
const TYPE_META = {
  spend:  { title: "지출 추가", color: "#FFA7AF" },
  income: { title: "수입 추가", color: "#B7C9FF" },
  save:   { title: "저축 추가", color: "#FFE899" },
};

function BottomSheet({ type, favorites, onClose, onSubmit, onSaveFavorite, editing, onDelete }) {
  const [amount, setAmount] = useState(editing ? editing.amount : 0);
  const [picked, setPicked] = useState(editing ? { top: editing.categoryTop, sub: editing.categorySub } : null);
  const [showFull, setShowFull] = useState(false);
  const [pickedTop, setPickedTop] = useState(editing ? editing.categoryTop : null);
  const [saveAsFav, setSaveAsFav] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoConfirmFav, setAutoConfirmFav] = useState(null);
  const [longPressFav, setLongPressFav] = useState(null);
  const meta = TYPE_META[type];
  const favScrollRef = useRef(null);
  const catScrollRef = useRef(null);
  // 양쪽 스크롤 가능 여부 (화살표 표시 조건)
  const [favCanL, setFavCanL] = useState(false);
  const [favCanR, setFavCanR] = useState(false);

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
    return () => { c1(); c2(); };
  }, [showFull]); // showFull 토글로 cat-row가 마운트/언마운트되니까 의존성

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
    if (n === "⌫") setAmount(Math.floor(amount / 10));
    else if (n === "00") setAmount(amount * 100 <= 99_999_999 ? amount * 100 : amount);
    else setAmount(amount * 10 + n <= 99_999_999 ? amount * 10 + n : amount);
  };

  const confirm = () => {
    if (amount <= 0) return;
    const sub = picked?.sub || "기타";
    const top = picked?.top || (type === "spend" ? "생활" : (type === "income" ? "수입" : "저축"));
    onSubmit({
      type,
      amount,
      categoryTop: top,
      categorySub: sub,
      saveAsFav: saveAsFav && sub !== "기타", // "기타"는 즐겨찾기 저장 의미 없음
    });
  };

  const pickFavorite = (f) => {
    setAmount(f.amount);
    setPicked({ top: f.categoryTop, sub: f.categorySub });
    setAutoConfirmFav(f.id);
    setTimeout(() => {
      onSubmit({
        type, amount: f.amount,
        categoryTop: f.categoryTop, categorySub: f.categorySub,
        fromFavorite: f.id,
      });
    }, 380);
  };

  const startLongPress = (f) => {
    const id = setTimeout(() => setLongPressFav(f), 550);
    return () => clearTimeout(id);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`bottom-sheet type-${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
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
          <div className="fav-label">★ 즐겨찾기 <span className="fav-hint">탭=입력 · 길게=편집</span></div>
          <div className="fav-scroll" ref={favScrollRef}>
            {myFavs.map((f) => {
              const dotColor = TOP_COLORS[f.categoryTop] || meta.color;
              return (
                <button
                  key={f.id}
                  className={`fav-chip ${autoConfirmFav === f.id ? "picked" : ""}`}
                  style={{ borderColor: meta.color }}
                  onClick={() => pickFavorite(f)}
                  onMouseDown={() => startLongPress(f)}
                  onTouchStart={() => startLongPress(f)}
                >
                  <span className="fav-dot" style={{ background: dotColor }} />
                  <span className="fav-name">{f.label}</span>
                  <span className="fav-amt">{f.amount.toLocaleString()}</span>
                  {f.usageCount >= 12 && <span className="fav-pin">📌</span>}
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
                  onClick={() => setPicked(qc)}
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
                    onClick={() => { setPicked({ top: pickedTop, sub: s }); setShowFull(false); }}
                  >
                    {s}
                  </button>
                );
              })}
              <button
                className="cat-sub-chip cat-sub-etc"
                onClick={() => { setPicked({ top: pickedTop, sub: "기타" }); setShowFull(false); }}
              >기타</button>
            </div>
          </div>
        )}

        {/* date — compact */}
        <div className="date-row">
          <button className="date-pill">
            <span>📅 오늘 · 5월 26일 (월)</span>
            <span className="date-chev">▾</span>
          </button>
        </div>

        {/* number pad */}
        <div className="numpad">
          {[1,2,3,4,5,6,7,8,9].map((n) => (
            <button key={n} className="np-btn" onClick={() => press(n)}>{n}</button>
          ))}
          <button className="np-btn np-aux" onClick={() => press("00")}>00</button>
          <button className="np-btn" onClick={() => press(0)}>0</button>
          <button className="np-btn np-aux" onClick={() => press("⌫")}>⌫</button>
        </div>

        {/* 즐겨찾기 저장 토글 — 확인 버튼 위 */}
        <button
          className={`save-fav-toggle ${saveAsFav ? "on" : ""}`}
          onClick={() => setSaveAsFav(!saveAsFav)}
          disabled={!picked || picked.sub === "기타"}
        >
          <span className="sft-star">{saveAsFav ? "★" : "☆"}</span>
          <span className="sft-text">
            {saveAsFav
              ? <>즐겨찾기에 <b>저장됨</b> · 다음에 1탭으로 입력</>
              : <>다음에도 빠르게 입력 · <b>즐겨찾기에 저장</b></>}
          </span>
        </button>

        <button
          className="confirm-btn"
          style={{ background: meta.color, color: "#0B1130" }}
          onClick={confirm}
          disabled={amount <= 0}
        >
          {amount > 0
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

        {longPressFav && (
          <div className="long-press-toast" onClick={() => setLongPressFav(null)}>
            <b>{longPressFav.label}</b> · 편집/삭제/순서변경 (구현 예정)
          </div>
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
const formatDateLabel = (iso) => {
  // "2026-05-26" → "5월 26일 (월)"
  const d = new Date(iso + "T00:00:00");
  const dow = ["일","월","화","수","목","금","토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dow})`;
};

function TransactionListSheet({ transactions, onClose, onEdit }) {
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
          <div className="list-title">항목 보기/수정</div>
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
                    <button
                      key={t.id}
                      className="list-row"
                      onClick={() => onEdit(t)}
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
                    </button>
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
Object.assign(window, { Board, EggCartonPanel, AngerRoomPanel, AppHeader, Controls, BottomNav, PoolZone, BottomSheet, TransactionListSheet, ThemeMascot });
})();
