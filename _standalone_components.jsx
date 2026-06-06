/* global React, GAME */
(function(){
const { useState, useEffect, useMemo, useCallback, useRef } = React;

const { COLS, ROWS, CELL, GAP, GOAL_ROW, SAVE_TONE, TIER } = window.GAME;

const CHICK_IMG = {
  save:  window.__resources.chickSave,
  spend: window.__resources.chickSpend,
  ghost: window.__resources.chickGhost,
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
function Board({ grid, active, activeCells, ghostCells, ghostMode, pulse }) {
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
        className="goal-line"
        style={{ top: GOAL_ROW * (CELL + GAP) - 1 }}
      >
        <div className="goal-dashes" />
        <div className="goal-tag">목표 지출선</div>
      </div>

      {/* danger zone shading */}
      <div
        className="danger-zone"
        style={{
          height: GOAL_ROW * (CELL + GAP) - 1,
        }}
      />

      {/* locked cells */}
      {lockedCells.map(({ r, c, kind, tier }) => {
        const t = tone(tier);
        const isGhost = ghostMode && kind !== "ghost"; // when ghostMode on, all chicks faint
        const src = isGhost ? CHICK_IMG.ghost : (kind === "save" ? CHICK_IMG.save : CHICK_IMG.spend);
        return (
          <div
            key={`lk-${r}-${c}`}
            className={`chick locked ${kind} ${isGhost ? "ghost" : ""}`}
            style={{
              ...cellAt(r,c),
              width: CELL, height: CELL,
              borderColor: t.stroke,
              backgroundColor: t.fill,
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
            <img src={CHICK_IMG.spend} alt="" draggable="false" />
          </div>
        );
      })}
    </div>
  );
}

// ── LEFT PANEL: EGG CARTON ─────────────────────────────────────
function EggCartonPanel({ eggs, goal }) {
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
          <span className="big">{eggs}</span>
          <span className="mid">/{goal}</span>
        </div>
        <div className="side-stat-cap">알 모음</div>
      </div>

      <div className="side-bar">
        <div className="side-bar-fill save" style={{ width: `${(eggs/goal)*100}%` }} />
      </div>
      <div className="side-foot">
        <span>1알 = 8만</span>
        <span className="streak">🔥 12일</span>
      </div>
    </div>
  );
}

// ── RIGHT PANEL: ANGER ROOM + TOP EXPENSES ─────────────────────
function AngerRoomPanel({ angerPct, topExpenses }) {
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
                  src={CHICK_IMG.spend}
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
              <img src={CHICK_IMG.spend} alt="" className="te-chick" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TOP HEADER ─────────────────────────────────────────────────
function AppHeader({ income, expense, saving, ghostMode }) {
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
            <div className="brand-name">병아리 테트리스</div>
            <div className="brand-sub">5월 21일 · DAY 21/31</div>
          </div>
        </div>
        <div className={`life-badge ${ghostMode ? "danger" : ""}`}>
          <span className="dot" />
          <span>{ghostMode ? "위험" : "안전"}</span>
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat-chip income">
          <div className="chip-label">수입</div>
          <div className="chip-val">{formatKRW(income)}</div>
          <div className="chip-unit">원</div>
        </div>
        <div className="stat-chip spend">
          <div className="chip-label">지출 <span className="chip-pct">{expPct}%</span></div>
          <div className="chip-val">{formatKRW(expense)}</div>
          <div className="chip-unit">원</div>
        </div>
        <div className="stat-chip save">
          <div className="chip-label">저축 <span className="chip-pct">{savPct}%</span></div>
          <div className="chip-val">{formatKRW(saving)}</div>
          <div className="chip-unit">원</div>
        </div>
      </div>
    </div>
  );
}

// ── BOTTOM CONTROLS ────────────────────────────────────────────
function Controls({ active, next, onMove, onRotate, onSoftDrop, onDrop, onRescue, rescueAvailable }) {
  const t = tone(active.tier);
  const nextT = tone(next.tier);

  // active piece preview shape
  const renderPreview = (piece, big = false) => {
    const SHAPES = window.GAME.SHAPES;
    const shape = SHAPES[piece.shape][0];
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
              <img src={CHICK_IMG.spend} alt="" />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="controls">
      {/* Active piece info */}
      <div className="active-card" style={{
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
            ● {TIER[active.tier]?.label}
          </div>
        </div>
        <div className="ac-right">
          <div className="next-mini">
            <div className="next-label">NEXT</div>
            {renderPreview(next)}
          </div>
        </div>
      </div>

      {/* D-pad row */}
      <div className="ctrl-row">
        <div className="dpad">
          <button className="btn arrow" onClick={() => onMove(-1)} aria-label="left">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 2 3 7l6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="btn arrow rotate" onClick={onRotate} aria-label="rotate">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3.5 5.5A5 5 0 1 1 3 9.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M1 4l3-.5L3.5 6.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="btn arrow" onClick={() => onMove(1)} aria-label="right">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M5 2l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="btn arrow" onClick={onSoftDrop} aria-label="down">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 5l5 6 5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <button className="btn drop" onClick={onDrop}>
          <span className="drop-glyph">▼</span>
          <span>DROP</span>
        </button>

        <button
          className={`btn rescue ${rescueAvailable <= 0 ? "disabled" : ""}`}
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

// ── BOTTOM NAV ─────────────────────────────────────────────────
function BottomNav({ ghostMode }) {
  const items = [
    { id: "home",   label: "홈",     icon: "▦", active: true },
    { id: "cal",    label: "달력",   icon: "▥" },
    { id: "stats",  label: "통계",   icon: "▤" },
    { id: "me",     label: "내 정보", icon: "◐" },
  ];
  return (
    <div className="bottom-nav">
      {items.map((it) => (
        <button key={it.id} className={`nav-item ${it.active ? "active" : ""}`}>
          <span className="nav-icon">{it.icon}</span>
          <span className="nav-label">{it.label}</span>
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { Board, EggCartonPanel, AngerRoomPanel, AppHeader, Controls, BottomNav });
})();
