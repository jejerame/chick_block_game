/* global React, ReactDOM */
const { useState, useEffect, useMemo } = React;

// ───────────────────────────────────────────────────────────────────
// CONSTANTS
// ───────────────────────────────────────────────────────────────────

const CELL = 56;
const COLS = 10;
const ROWS = 20;
const GAP = 2;

const TYPE_COLOR = {
  I: "#00BCD4",
  O: "#FFC107",
  T: "#9C27B0",
  S: "#4CAF50",
  Z: "#F44336",
  L: "#FF9800",
  J: "#2196F3",
};

const CHICK = {
  save: "assets/chick_save.png",
  spend: "assets/chick_spend.png",
  ghost: "assets/chick_ghost.png",
};

// Helper: hex → rgba with alpha
const tint = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ───────────────────────────────────────────────────────────────────
// BOARD STATE
// row 0 = top, row 19 = bottom. col 0 = left.
// Cells are placed as tetromino pieces.
// ───────────────────────────────────────────────────────────────────

// Each piece: { type, kind, cells: [[r,c], ...] }
const PIECES = [
  // ── Bottom row stack ──
  { type: "O", kind: "save",  cells: [[18,0],[18,1],[19,0],[19,1]] },
  { type: "L", kind: "spend", cells: [[18,3],[19,2],[19,3],[19,4]] },  // L-spend
  { type: "T", kind: "spend", cells: [[18,6],[19,5],[19,6],[19,7]] },  // T-spend pointing up
  { type: "O", kind: "spend", cells: [[18,8],[18,9],[19,8],[19,9]] },

  // ── Row 17 / 16 ──
  { type: "I", kind: "save",  cells: [[17,3],[17,4],[17,5],[17,6]] },  // horizontal I
  { type: "Z", kind: "spend", cells: [[16,7],[16,8],[17,8],[17,9]] },  // Z

  // ── Row 15-17 left edge ──
  { type: "J", kind: "save",  cells: [[15,0],[16,0],[17,0],[17,1]] },  // J/L vertical

  // ── Row 13-15 middle ──
  { type: "S", kind: "save",  cells: [[14,4],[14,5],[15,3],[15,4]] },  // S-piece
  { type: "O", kind: "save",  cells: [[14,8],[14,9],[15,8],[15,9]] },

  // ── Row 11-13 ──
  { type: "T", kind: "save",  cells: [[12,2],[13,1],[13,2],[13,3]] },  // T pointing up

  // ── Row 9-10 (just under goal line) ──
  { type: "L", kind: "spend", cells: [[10,6],[10,7],[10,8],[11,8]] },  // L

  // ── Falling piece (current) ──
  { type: "T", kind: "save",  cells: [[2,4],[3,3],[3,4],[3,5]] },
];

// Goal expense line — between row 8 (above) and row 9 (below)
// Rows 9-19 are "within budget"; anything above row 8 = over budget
const GOAL_LINE_ROW = 9;

// Build cell grid
function buildGrid() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (const piece of PIECES) {
    for (const [r, c] of piece.cells) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        grid[r][c] = { type: piece.type, kind: piece.kind };
      }
    }
  }
  return grid;
}

// ───────────────────────────────────────────────────────────────────
// COMPONENTS
// ───────────────────────────────────────────────────────────────────

function TopBar() {
  const stats = [
    { label: "이번 달 수입",   value: "3,200,000", unit: "원", tone: "neutral" },
    { label: "지출",          value: "1,840,000", unit: "원", tone: "spend"   },
    { label: "저축",          value: "1,360,000", unit: "원", tone: "save"    },
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <img src={CHICK.save} alt="" />
        </div>
        <div className="brand-text">
          <div className="brand-name">병아리 테트리스</div>
          <div className="brand-sub">5월 가계 · DAY 21 / 31</div>
        </div>
      </div>
      <div className="stats">
        {stats.map((s) => (
          <div key={s.label} className={`stat stat-${s.tone}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">
              <span className="num">{s.value}</span>
              <span className="unit">{s.unit}</span>
            </div>
          </div>
        ))}
        <div className="combo">
          <div className="combo-label">절약 콤보</div>
          <div className="combo-value">×4</div>
          <div className="combo-pips">
            {[1,2,3,4,5,6,7].map((i) => (
              <span key={i} className={i <= 4 ? "pip on" : "pip"} />
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

// Egg carton — 6 cols × 5 rows = 30 eggs
function EggCarton() {
  const TOTAL = 30;
  const FILLED = 17; // saved 17 of 30 goal eggs
  const eggs = Array.from({ length: TOTAL }, (_, i) => ({
    filled: i < FILLED,
    cracked: i === FILLED, // next slot being filled
  }));
  return (
    <aside className="panel egg-panel">
      <div className="panel-head">
        <div className="panel-eyebrow">저축 시각화</div>
        <div className="panel-title">계란판 적금</div>
      </div>

      <div className="egg-progress">
        <div className="egg-progress-row">
          <div className="egg-progress-num">
            <span className="big">17</span>
            <span className="mid">/ 30알</span>
          </div>
          <div className="egg-progress-pct">57<small>%</small></div>
        </div>
        <div className="egg-progress-bar">
          <div className="egg-progress-fill" style={{ width: "57%" }} />
        </div>
        <div className="egg-progress-meta">
          <span>1알 = 80,000원</span>
          <span>목표 2,400,000원</span>
        </div>
      </div>

      <div className="carton">
        <div className="carton-inner">
          {eggs.map((e, i) => (
            <div key={i} className="egg-slot">
              <div className="egg-dimple" />
              {e.filled && (
                <div className="egg">
                  <div className="egg-shine" />
                </div>
              )}
              {e.cracked && (
                <div className="egg cracked">
                  <div className="crack" />
                  <div className="egg-shine" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="carton-tab">
          <span>EGG · 30</span>
          <span>5월 적금</span>
        </div>
      </div>

      <div className="egg-streak">
        <div className="streak-row">
          <span className="streak-dot" />
          <span className="streak-label">연속 저축</span>
          <span className="streak-value">12일</span>
        </div>
        <div className="streak-row">
          <span className="streak-dot saved" />
          <span className="streak-label">이번 주 목표</span>
          <span className="streak-value">5 / 7알</span>
        </div>
      </div>
    </aside>
  );
}

// Single tetris cell
function Cell({ data, row }) {
  if (!data) {
    return <div className="cell empty" />;
  }
  const color = TYPE_COLOR[data.type];
  // ghost state: above goal line AND spend piece → angel/ghost chick
  const overBudget = row < GOAL_LINE_ROW && data.kind === "spend";
  const chickSrc = overBudget ? CHICK.ghost : CHICK[data.kind];
  return (
    <div
      className={`cell filled ${data.kind} ${overBudget ? "ghost" : ""}`}
      style={{
        backgroundColor: tint(color, 0.15),
        borderColor: color,
        boxShadow: `inset 0 0 0 1px ${tint(color, 0.4)}`,
      }}
    >
      <img src={chickSrc} alt="" draggable="false" />
    </div>
  );
}

function GameFrame() {
  const grid = useMemo(buildGrid, []);

  // build column-pressure indicator (how full each column is)
  const colHeights = useMemo(() => {
    return Array.from({ length: COLS }, (_, c) => {
      let count = 0;
      for (let r = 0; r < ROWS; r++) if (grid[r][c]) count++;
      return count;
    });
  }, [grid]);

  return (
    <section className="game">
      <div className="game-head">
        <div>
          <div className="game-eyebrow">이번 달 보드</div>
          <div className="game-title">테트리스 가계 · 5월</div>
        </div>
        <div className="game-controls">
          <button className="ctrl">
            <span className="ctrl-key">←</span>
            <span>이전</span>
          </button>
          <button className="ctrl active">
            <span className="ctrl-dot" />
            <span>5월</span>
          </button>
          <button className="ctrl">
            <span>다음</span>
            <span className="ctrl-key">→</span>
          </button>
        </div>
      </div>

      <div className="board-wrap">
        {/* column pressure strip */}
        <div className="pressure-strip">
          {colHeights.map((h, i) => (
            <div key={i} className="pressure-col">
              <div className="pressure-fill" style={{ height: `${(h/ROWS)*100}%` }} />
            </div>
          ))}
        </div>

        <div
          className="board"
          style={{
            gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
            gap: `${GAP}px`,
            padding: `${GAP}px`,
          }}
        >
          {grid.map((row, r) =>
            row.map((cell, c) => (
              <Cell key={`${r}-${c}`} data={cell} row={r} />
            ))
          )}

          {/* Goal line overlay */}
          <div
            className="goal-line"
            style={{
              top: `${GOAL_LINE_ROW * (CELL + GAP) + GAP - 1}px`,
            }}
          >
            <div className="goal-tag">
              <span className="goal-dot" />
              목표 지출선 · 2,000,000원
            </div>
            <div className="goal-dashes" />
          </div>

          {/* drop preview shadow under falling piece */}
          <div
            className="ghost-piece"
            style={{
              top: `${15 * (CELL + GAP) + GAP}px`,
              left: `${3 * (CELL + GAP) + GAP}px`,
              width: `${3 * CELL + 2 * GAP}px`,
              height: `${2 * CELL + GAP}px`,
            }}
          />
        </div>

        {/* right rail labels */}
        <div className="row-rail">
          <span style={{ top: 0 }}>OVER</span>
          <span style={{ top: `${(GOAL_LINE_ROW) * (CELL + GAP)}px` }} className="rail-goal">목표선</span>
          <span style={{ top: `${(ROWS - 1) * (CELL + GAP)}px` }}>SAFE</span>
        </div>
      </div>

      <div className="board-foot">
        <div className="legend">
          <span className="legend-item"><span className="sw save" /> 노란 병아리 = 저축</span>
          <span className="legend-item"><span className="sw spend" /> 빨간 병아리 = 지출</span>
          <span className="legend-item"><span className="sw ghost" /> 천사 병아리 = 예산 초과</span>
        </div>
        <div className="next-piece">
          <span className="next-label">NEXT</span>
          <div className="next-grid">
            {[[0,1],[1,0],[1,1],[1,2]].map(([r,c],i) => (
              <div key={i} className="next-cell" style={{
                gridRow: r+1, gridColumn: c+1,
                backgroundColor: tint(TYPE_COLOR.T, 0.15),
                borderColor: TYPE_COLOR.T,
              }}>
                <img src={CHICK.save} alt="" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AngerGauge() {
  const PCT = 78; // 78% to anger threshold
  return (
    <div className="panel anger-panel">
      <div className="panel-head">
        <div className="panel-eyebrow">지출 게이지</div>
        <div className="panel-title">분노의 방</div>
      </div>

      <div className="anger-stage">
        <div className="anger-room">
          <div className="anger-wall" />
          <div className="anger-floor" />
          <img className="anger-chick" src={CHICK.spend} alt="" />
          <div className="anger-burst b1">!!</div>
          <div className="anger-burst b2">??</div>
          <div className="anger-burst b3">!?</div>
        </div>
        <div className="anger-meter">
          <div className="anger-meter-track">
            <div className="anger-meter-fill" style={{ height: `${PCT}%` }}>
              <div className="anger-meter-glow" />
            </div>
            <div className="anger-meter-marks">
              {[20,40,60,80].map((p) => (
                <span key={p} style={{ bottom: `${p}%` }} />
              ))}
            </div>
            <div className="anger-meter-cap" style={{ bottom: `90%` }}>
              <span>한계</span>
            </div>
          </div>
          <div className="anger-meter-foot">
            <div className="meter-pct">{PCT}<small>%</small></div>
            <div className="meter-cap">분노 게이지</div>
          </div>
        </div>
      </div>

      <div className="anger-stats">
        <div className="anger-stat">
          <div className="anger-stat-label">예산 대비</div>
          <div className="anger-stat-value warn">+92%</div>
        </div>
        <div className="anger-stat">
          <div className="anger-stat-label">남은 일수</div>
          <div className="anger-stat-value">10일</div>
        </div>
        <div className="anger-stat">
          <div className="anger-stat-label">하루 한도</div>
          <div className="anger-stat-value">16,000<small>원</small></div>
        </div>
      </div>
    </div>
  );
}

function TopExpenses() {
  const items = [
    { rank: 1, cat: "외식 / 배달", amount: 482000, count: 17, pct: 92, type: "Z", trend: "+24%" },
    { rank: 2, cat: "구독 · 멤버십", amount: 318000, count:  9, pct: 71, type: "L", trend: "+8%"  },
    { rank: 3, cat: "택시 · 교통",  amount: 246000, count: 22, pct: 54, type: "T", trend: "−12%" },
  ];
  return (
    <div className="panel top-expenses">
      <div className="panel-head">
        <div className="panel-eyebrow">분노 유발 TOP 3</div>
        <div className="panel-title">상위 지출 항목</div>
      </div>
      <div className="exp-list">
        {items.map((it) => {
          const color = TYPE_COLOR[it.type];
          return (
            <div key={it.rank} className="exp">
              <div className="exp-rank" style={{ background: tint(color, 0.18), color }}>
                {String(it.rank).padStart(2, "0")}
              </div>
              <div className="exp-body">
                <div className="exp-row">
                  <div className="exp-cat">{it.cat}</div>
                  <div className={`exp-trend ${it.trend.startsWith("−") ? "down" : "up"}`}>{it.trend}</div>
                </div>
                <div className="exp-amount">
                  <span className="exp-num">{it.amount.toLocaleString()}</span>
                  <span className="exp-unit">원 · {it.count}건</span>
                </div>
                <div className="exp-bar">
                  <div className="exp-bar-fill" style={{
                    width: `${it.pct}%`,
                    background: `linear-gradient(90deg, ${tint(color, 0.4)}, ${color})`,
                  }} />
                </div>
              </div>
              <div className="exp-chick">
                <img src={CHICK.spend} alt="" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="diet-card">
        <div className="diet-icon">
          <img src={CHICK.ghost} alt="" />
        </div>
        <div className="diet-text">
          <div className="diet-title">지출 다이어트 추천</div>
          <div className="diet-sub">외식 1회 줄이면 <strong>병아리 3마리</strong> 더 저축할 수 있어요</div>
        </div>
        <button className="diet-cta">시작</button>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="app">
      <TopBar />
      <main className="body">
        <EggCarton />
        <GameFrame />
        <div className="right-col">
          <AngerGauge />
          <TopExpenses />
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
