/* global React */

// ── BOARD CONSTANTS ────────────────────────────────────────────────
window.GAME = (() => {
  const COLS = 8;
  const ROWS = 16;
  const CELL = 26; // 미리보기: 22→26 (8×16 칸 수 동일 · 가독성·세로 여백)
  const GAP  = 1;
  const GOAL_ROW = 5;        // ★ 보드상 목표 지출선 — 고정 (게임 규칙, 5행)
  const TARGET_SPEND_RATIO = 0.8; // 누적 수입의 80% = 지출 목표(금액). 초과 시 위험
  const SPAWN = { r: 0, c: 3 };

  // ── COLORS (pastel — dark tint cell + saturated border) ─────
  const SAVE_TONE = { stroke: "#E5C04F", fill: "rgba(255, 232, 153, 0.16)" };
  const TIER = {
    blue:   { stroke: "#6E96FF", fill: "rgba(178, 199, 255, 0.16)", label: "<1만",    hint: "커피·간식" },
    cyan:   { stroke: "#3FBBD8", fill: "rgba(157, 221, 240, 0.16)", label: "1–5만",   hint: "편의점·소품" },
    green:  { stroke: "#5BBE80", fill: "rgba(184, 230, 193, 0.18)", label: "5–10만",  hint: "외식·교통" },
    orange: { stroke: "#F08A4D", fill: "rgba(255, 196, 152, 0.20)", label: "10–50만", hint: "쇼핑·구독" },
    red:    { stroke: "#E54C5A", fill: "rgba(255, 154, 162, 0.22)", label: "50만+",   hint: "큰 결제" },
  };

  // ── TETROMINO ROTATIONS ──────────────────────────────────────
  const SHAPES = {
    T: [
      [[0,1],[1,0],[1,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,1]],
      [[1,0],[1,1],[1,2],[2,1]],
      [[0,1],[1,0],[1,1],[2,1]],
    ],
    L: [
      [[0,0],[1,0],[2,0],[2,1]],
      [[0,0],[0,1],[0,2],[1,0]],
      [[0,0],[0,1],[1,1],[2,1]],
      [[0,2],[1,0],[1,1],[1,2]],
    ],
    J: [
      [[0,1],[1,1],[2,0],[2,1]],
      [[0,0],[1,0],[1,1],[1,2]],
      [[0,0],[0,1],[1,0],[2,0]],
      [[0,0],[0,1],[0,2],[1,2]],
    ],
    S: [
      [[0,1],[0,2],[1,0],[1,1]],
      [[0,0],[1,0],[1,1],[2,1]],
    ],
    Z: [
      [[0,0],[0,1],[1,1],[1,2]],
      [[0,1],[1,0],[1,1],[2,0]],
    ],
    O: [[[0,0],[0,1],[1,0],[1,1]]],
    I: [
      [[1,0],[1,1],[1,2],[1,3]],
      [[0,0],[1,0],[2,0],[3,0]],
    ],
    DOT: [[[0,0]]],
  };

  // ── 모노(낙알) 낱알 경계 — 고정 2만 ────────────────────────────
  // 1원~2만 지출은 풀에 모이지 않고 1×1 낱알로 즉시 낙하 + 자동 끝워넣기.
  //   < 1만 → 기절한 흰 병아리 낱알 (subtype "faint")
  //   1만 ~ 2만 → 빨간 병아리 낱알 (subtype "red")
  const MONO_MAX = 20_000;   // 이 금액 미만은 낱알로 처리 (고정)
  const MONO_RED = 10_000;   // 이 금액 이상이면 빨간 병아리
  function monoSubtype(amount) {
    return amount >= MONO_RED ? "red" : "faint";
  }

  // 자동 끝워넣기: 보드에서 채울 가장 좋은 빈칸 1개를 찾는다.
  //   우선순위 1) 덮인 구멍(hole) 중 가장 깊은 것 → 구멍 메우기
  //            2) 구멍이 없으면 높이가 가장 낮은 컴럼 맨 위
  // → 난알이 빈틈을 메워 표면이 평평해지고 보드 수명이 늘어난다.
  function pickFillCell(grid) {
    // 1) hole 탐색 (같은 컴럼에서 위에 차있는 칸이 있는 빈칸)
    let bestHole = null; // [r, c], r 클수록 깊음
    for (let c = 0; c < COLS; c++) {
      let seenFilled = false;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r] && grid[r][c]) { seenFilled = true; continue; }
        if (seenFilled) {
          // 빈칸인데 위에 차있는 칸 존재 → hole
          if (!bestHole || r > bestHole[0]) bestHole = [r, c];
        }
      }
    }
    if (bestHole) return bestHole;

    // 2) hole 없음 → 높이 가장 낮은 컴럼의 맨 위 빈칸
    let bestCol = -1, bestLandR = -1;
    for (let c = 0; c < COLS; c++) {
      // 이 컴럼에서 떨어뜨렸을 때 멈추는 행
      let landR = ROWS - 1;
      for (let r = 0; r < ROWS; r++) {
        if (grid[r] && grid[r][c]) { landR = r - 1; break; }
      }
      if (landR < 0) continue; // 컴럼이 꽉 챠음
      if (landR > bestLandR) { bestLandR = landR; bestCol = c; }
    }
    if (bestCol >= 0) return [bestLandR, bestCol];
    return null; // 보드 가득
  }

  // ★ 굳히기 — 완전히 꽉 찬 "지출" 줄을 회색 콘크리트로 굳힌다(영구).
  //   라인 클리어 대신: "쓴 돈은 화석처럼 남는다" 메타포.
  //   저축(save)만으로 채워진 줄은 굳히지 않음 → 저축 보상으로 클리어 가능하게 유지.
  function hardenFullRows(grid) {
    const ng = grid.map((row) => row.slice());
    const newlyHardened = [];
    let changed = false;
    for (let r = 0; r < ROWS; r++) {
      const row = ng[r];
      if (!row.every((c) => c)) continue;          // 꽉 안 참
      const hasSpend = row.some((c) => c.kind === "spend");
      if (!hasSpend) continue;                       // 저축 전용 줄 → 보상 클리어 대상, 패스
      let rowChanged = false;
      for (let c = 0; c < COLS; c++) {
        const cell = row[c];
        if (cell.kind === "spend" && !cell.hardened) {
          row[c] = { ...cell, hardened: true };
          rowChanged = true;
        }
      }
      if (rowChanged) { changed = true; newlyHardened.push(r); }
    }
    return { grid: changed ? ng : grid, newlyHardened };
  }

  // Build initial board state — already-played pieces
  function makeInitGrid() {
    const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const put = (r, c, kind, tier, amount) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        g[r][c] = { kind, tier: tier || (kind === "save" ? "save" : "cyan"), amount: amount || 0 };
      }
    };
    const piece = (kind, tier, amount, cells) => {
      cells.forEach(([r,c]) => put(r,c,kind,tier,amount));
    };

    // ── SAVINGS — fill bottom two rows neatly (rows 14, 15) ──
    piece("save", "save", 80000, [[15,0],[15,1],[14,0],[14,1]]); // O
    piece("save", "save", 80000, [[15,2],[15,3],[15,4],[14,3]]); // T flat-up
    piece("save", "save", 80000, [[15,5],[15,6],[15,7],[14,7]]); // L
    piece("save", "save", 80000, [[14,4],[14,5],[14,6],[13,5]]); // T
    piece("save", "save", 80000, [[13,0],[13,1],[13,2],[12,2]]); // L

    // ── SPENDS — with intentional gaps so rows never clear ──
    // Row 12: orange pair right
    piece("spend", "orange", 215000, [[12,5],[12,6],[11,6],[11,7]]); // S
    // Row 11-12: green
    piece("spend", "green",   82000, [[12,3],[12,4],[11,3],[11,4]]); // O — wait collides w/ [12,3] orange? Let me check
    // Actually [12,3] and [12,4] are not yet taken. good.
    // Row 10-11 left
    piece("spend", "red",    642000, [[11,0],[10,0],[10,1],[10,2]]); // J
    // Row 9 - cyan
    piece("spend", "cyan",    36000, [[9,5],[9,6],[10,5],[10,6]]); // O
    // Row 8 - blue (small) with gap
    piece("spend", "blue",     8200, [[8,2],[8,3],[9,2],[9,3]]); // O
    // Row 7 - one stray
    piece("spend", "green",   65000, [[7,5],[7,6],[8,6]]);

    return g;
  }

  /** 랜딩 캡처용 — 블록이 더 많이 쌓인 고정 스냅샷 (실제 거래 상태와 무관) */
  function makeLandingHeroGrid() {
    const g = makeInitGrid();
    const piece = (kind, tier, amount, cells) => {
      cells.forEach(([r, c]) => {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          g[r][c] = { kind, tier: tier || (kind === "save" ? "save" : "cyan"), amount: amount || 0 };
        }
      });
    };
    piece("spend", "cyan",   28000, [[8,0],[8,1],[9,0],[9,1]]);
    piece("spend", "cyan",   32000, [[8,3],[8,4],[9,3],[9,4]]);
    piece("spend", "cyan",   41000, [[7,6],[7,7],[8,6],[8,7]]);
    piece("spend", "green",  78000, [[6,5],[6,6],[7,5],[7,6]]);
    piece("spend", "green",  92000, [[6,2],[5,2],[5,3],[5,4]]);
    piece("spend", "green",  88000, [[6,0],[5,0],[5,1],[4,1]]);
    piece("spend", "orange", 198000, [[5,5],[4,5],[4,6],[4,7]]);
    piece("spend", "orange", 245000, [[4,0],[4,1],[3,0],[3,1]]);
    piece("spend", "orange", 310000, [[4,3],[3,3],[3,4],[2,4]]);
    piece("spend", "red",    520000, [[3,5],[3,6],[2,5],[2,6],[1,5]]);
    piece("spend", "red",    680000, [[2,2],[2,3],[1,2],[1,3],[0,2]]);
    piece("spend", "blue",    8500, [[10,0],[10,1],[11,0]]);
    piece("spend", "blue",   12000, [[10,4],[11,4],[11,5]]);
    piece("spend", "blue",    6500, [[10,7],[11,7]]);
    piece("save",  "save",   50000, [[14,2],[14,3],[13,3]]);
    piece("save",  "save",   80000, [[15,5],[15,6],[14,6]]);
    return hardenFullRows(g).grid;
  }

  /** 빈 홈 1회 데모 — 목표 지출선(GOAL_ROW) 아래만 쌓음 → 기절(흰 병아리) 없음 */
  function makeEmptyHomePreviewGrid() {
    const g = makeBaseGrid();
    const piece = (kind, tier, amount, cells) => {
      cells.forEach(([r, c]) => {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          g[r][c] = { kind, tier: tier || (kind === "save" ? "save" : "cyan"), amount: amount || 0 };
        }
      });
    };
    /* 저축 — 바닥 */
    piece("save", "save", 50000, [[15, 0], [15, 1], [14, 0], [14, 1]]);
    piece("save", "save", 80000, [[15, 5], [15, 6], [14, 6], [14, 5]]);
    /* 지출 — 전부 GOAL_ROW(5)보다 아래 행만 (r >= 6), 윗면은 6~8행 근처 */
    piece("spend", "blue", 8500, [[13, 0], [13, 1], [14, 1]]);
    piece("spend", "blue", 12000, [[13, 7], [14, 7]]);
    piece("spend", "cyan", 28000, [[12, 2], [12, 3], [13, 2], [13, 3]]);
    piece("spend", "cyan", 36000, [[11, 5], [11, 6], [12, 5], [12, 6]]);
    piece("spend", "green", 78000, [[10, 0], [10, 1], [11, 0], [11, 1]]);
    piece("spend", "green", 92000, [[9, 4], [9, 5], [10, 4], [10, 5]]);
    piece("spend", "orange", 198000, [[8, 2], [8, 3], [9, 2], [9, 3]]);
    piece("spend", "orange", 245000, [[7, 6], [7, 7], [8, 6], [8, 7]]);
    piece("spend", "red", 520000, [[6, 2], [6, 3], [7, 2], [7, 3], [6, 4]]);
    return g;
  }

  // ── POOL SYSTEM ──────────────────────────────────────────────
  // 풀이 임계 금액을 넘는 순간 해당 티어의 블록이 자동 실체화 + 낙하한다.
  // ★ 임계값은 수입 비례. getThresholds(income) 로 동적 계산.
  //   포화 완화 튜닝: cyan 2% / green 4% / orange 18% (기존 1.5·3·15에서 상향)
  const TIER_RATIO = { cyan: 0.02, green: 0.04, orange: 0.18 };
  const POOL_TIER_ORDER = ["orange", "green", "cyan"];
  const roundMan = (n) => {
    // 1만 단위로 반올림. 최소 1만.
    const r = Math.max(10_000, Math.round(n / 10_000) * 10_000);
    return r;
  };
  function getThresholds(income) {
    return {
      cyan:   roundMan(income * TIER_RATIO.cyan),
      green:  roundMan(income * TIER_RATIO.green),
      orange: roundMan(income * TIER_RATIO.orange),
    };
  }

  /** 이번 달 지출 목표 금액 = 누적 수입 × 80% */
  function getTargetSpend(income) {
    return Math.round(Math.max(0, income) * TARGET_SPEND_RATIO);
  }

  /** 지출이 수입의 80%를 넘으면 예산 초과(위험) */
  function isOverBudget(expense, income) {
    return expense >= getTargetSpend(income);
  }
  // 디폴트(320만 기준)는 기존 시각 호환용으로 유지 — 런타임에선 getThresholds 사용
  const TIER_THRESHOLD = getThresholds(3_200_000);
  const SHAPE_BY_TIER = {
    cyan:   ["S", "Z"],
    green:  ["T", "O"],
    orange: ["L", "J"],
    red:    ["I"],
  };
  const TIER_HINT_LABEL = {
    cyan:   "편의점·소품 합산",
    green:  "외식·교통 합산",
    orange: "쇼핑·구독 합산",
    red:    "큰 결제",
  };
  function pickShapeFor(tier) {
    const arr = SHAPE_BY_TIER[tier] || ["O"];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** 풀 합계에서 넘은 가장 높은 티어 1개만 (한 번에 블록 1개 정책) */
  function highestPoolTier(cur, thresholds) {
    for (const t of POOL_TIER_ORDER) {
      if (cur >= thresholds[t]) return t;
    }
    return null;
  }

  /**
   * 풀에 금액 합산 후 블록은 최대 1개만 실체화, 나머지는 pool carry.
   * 라이브 onSpend · recompute simSpend 공통.
   */
  function applyPoolDeposit(pool, amount, thresholds) {
    const cur = pool + amount;
    const tier = highestPoolTier(cur, thresholds);
    if (!tier) return { pool: cur, tier: null, thresholdValue: 0 };
    const thresholdValue = thresholds[tier];
    return { pool: cur - thresholdValue, tier, thresholdValue };
  }

  // ── Recompute (거래 → 보드/풀 결정론적 재시뮬레이션) ─────────────
  const DEFAULT_INCOME = 3_200_000;

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function next() {
      let a = seed | 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickShapeForSeeded(tier, rng) {
    const arr = SHAPE_BY_TIER[tier] || ["O"];
    return arr[Math.floor(rng() * arr.length)];
  }

  function cloneGrid(g) {
    return g.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  /** recompute 시작 보드 — 빈 그리드 (지출·저축 모두 거래 재생으로만 쌓음) */
  function makeBaseGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function simulateLock(grid, active) {
    const isSave = active.kind === "save";
    const variants = SHAPES[active.shape];
    const shape = variants[active.rot % variants.length];
    let dr = 0;
    while (true) {
      const test = shape.map(([r, c]) => [active.pos.r + dr + 1 + r, active.pos.c + c]);
      if (test.some(([r, c]) => r >= ROWS || c < 0 || c >= COLS || (grid[r] && grid[r][c]))) break;
      dr++;
    }
    const landed = shape.map(([r, c]) => [active.pos.r + dr + r, active.pos.c + c]);
    const newGrid = cloneGrid(grid);
    let placed = false;
    landed.forEach(([r, c]) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !newGrid[r][c]) {
        newGrid[r][c] = isSave
          ? { kind: "save", tier: "save", amount: active.amount }
          : { kind: "spend", tier: active.tier, amount: active.amount };
        placed = true;
      }
    });
    if (!placed) return { grid, landed: [] };
    if (isSave) return { grid: newGrid, landed };
    const { grid: hardened } = hardenFullRows(newGrid);
    return { grid: hardened, landed };
  }

  const AVG_CELLS_PER_BLOCK = 4;
  const BOARD_CELL_COUNT = ROWS * COLS;

  /** 보드에 실제 쌓인 지출·저축 셀 수 */
  function countOccupiedCells(grid) {
    let n = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r] && grid[r][c]) n++;
      }
    }
    return n;
  }

  /**
   * (지출+저축)/수입 → 보드에 채울 총 셀 수.
   * 지출·저축을 각각 수입 대비 %로 잡으면 합이 100%를 넘어 보드가 과채워짐.
   */
  function targetBoardCells(income, expense, savings) {
    const inc = income > 0 ? income : DEFAULT_INCOME;
    const ratio = Math.min(1, Math.max(0, (expense + savings) / inc));
    return Math.round(ratio * BOARD_CELL_COUNT);
  }

  /** 목표 셀 수까지 낱알로 보정 (테트로미노 배치 실패 시 100% 미달 방지) */
  function syncGridToTarget(grid, targetTotal, kind) {
    let g = grid;
    let guard = 0;
    while (countOccupiedCells(g) < targetTotal && guard++ < BOARD_CELL_COUNT) {
      const before = countOccupiedCells(g);
      if (kind === "save") {
        const cell = pickFillCell(g);
        if (!cell) break;
        const [r, c] = cell;
        const ng = cloneGrid(g);
        ng[r][c] = { kind: "save", tier: "save", amount: 1 };
        g = ng;
      } else {
        g = placeMonoOnGrid(g, 1);
      }
      if (countOccupiedCells(g) <= before) break;
    }
    return g;
  }

  /** 저축 — 이번 거래로 추가할 셀 수만큼 O 블록 즉시 착지 */
  function placeSaveVolume(grid, cellsNeeded, amount, seedBase) {
    if (cellsNeeded <= 0) return grid;
    let g = grid;
    const start = countOccupiedCells(g);
    const goal = Math.min(BOARD_CELL_COUNT, start + cellsNeeded);
    const n = Math.max(1, Math.ceil(cellsNeeded / AVG_CELLS_PER_BLOCK));
    const perAmt = Math.max(1, Math.round(amount / n));
    let i = 0;
    while (countOccupiedCells(g) < goal && i < n + 4) {
      const before = countOccupiedCells(g);
      const posC = pickSmartCol(g, "O", 0);
      const active = {
        shape: "O",
        kind: "save",
        tier: "save",
        amount: perAmt,
        label: "저축",
        pos: { r: 0, c: posC },
        rot: 0,
      };
      const { grid: next } = simulateLock(g, active);
      if (countOccupiedCells(next) <= before) break;
      g = next;
      i++;
    }
    return g;
  }

  function placeMonoOnGrid(grid, amount) {
    const cell = pickFillCell(grid);
    if (!cell) return grid;
    const [r, c] = cell;
    const ng = cloneGrid(grid);
    ng[r][c] = {
      kind: "spend",
      tier: "blue",
      mono: true,
      subtype: monoSubtype(amount),
      amount,
    };
    return hardenFullRows(ng).grid;
  }

  /**
   * 목표 지출선 행 — 수입의 80%(TARGET_SPEND_RATIO) 한도.
   * 보드 전체=100% 수입, 선 위치=80% 지점(고정). 저축·현재 지출액과 무관.
   */
  function computeGoalRow() {
    return Math.max(1, Math.min(ROWS - 2, Math.round(ROWS * (1 - TARGET_SPEND_RATIO))));
  }

  /** 소액 낱알 — cellsNeeded 칸까지만 */
  function placeMonosForVolume(grid, amount, cellsNeeded) {
    if (cellsNeeded <= 0) return grid;
    const cells = cellsNeeded;
    const perCell = Math.max(1, Math.round(amount / cells));
    let g = grid;
    let remaining = cells;
    while (remaining > 0) {
      const before = countOccupiedCells(g);
      g = placeMonoOnGrid(g, perCell);
      const added = countOccupiedCells(g) - before;
      if (added <= 0) break;
      remaining -= added;
    }
    return g;
  }

  function lockBlockOnGrid(grid, tier, blockAmount, label, seedKey) {
    const rng = mulberry32(hashSeed(seedKey));
    const shape = pickShapeForSeeded(tier, rng);
    const posC = pickSmartCol(grid, shape, 0);
    const active = {
      shape,
      kind: "spend",
      tier,
      amount: blockAmount,
      label,
      pos: { r: 0, c: posC },
      rot: 0,
    };
    const { grid: next } = simulateLock(grid, active);
    return next;
  }

  function simSpend(grid, pool, amount, label, thresholds, seedBase, cellsNeeded) {
    let g = grid;
    let p = pool;
    let remaining = Math.max(0, cellsNeeded);

    if (amount >= thresholds.orange) {
      if (remaining <= 0) return { grid: g, pool: p };
      const n = Math.max(1, Math.ceil(remaining / AVG_CELLS_PER_BLOCK));
      const perAmt = Math.max(1, Math.round(amount / n));
      for (let i = 0; i < n && remaining > 0; i++) {
        const before = countOccupiedCells(g);
        g = lockBlockOnGrid(g, "red", perAmt, label, `${seedBase}-red-${i}`);
        const added = Math.max(0, countOccupiedCells(g) - before);
        if (added <= 0 || countOccupiedCells(g) === before) break;
        remaining -= added;
      }
      return { grid: g, pool: p };
    }

    if (amount < MONO_MAX) {
      if (remaining <= 0) return { grid: g, pool: p };
      g = placeMonosForVolume(g, amount, remaining);
      return { grid: g, pool: p };
    }

    const dep = applyPoolDeposit(p, amount, thresholds);
    p = dep.pool;
    if (dep.tier && remaining > 0) {
      const before = countOccupiedCells(g);
      g = lockBlockOnGrid(
        g,
        dep.tier,
        dep.thresholdValue,
        TIER_HINT_LABEL[dep.tier],
        `${seedBase}-pool-${dep.tier}`
      );
      if (countOccupiedCells(g) === before) {
        // 보드 포화 — 풀만 반영
      }
    }
    return { grid: g, pool: p };
  }

  /** 해당 거래 묶음에서 풀→블록 실체화(applyPoolDeposit tier) 횟수 */
  function countPoolSpawnsInTransactions(txs) {
    const sorted = [...txs].sort((a, b) => a.createdAt - b.createdAt);
    let income = 0;
    let pool = 0;
    let spawns = 0;
    for (const tx of sorted) {
      const effIncome = income > 0 ? income : DEFAULT_INCOME;
      const th = getThresholds(effIncome);
      if (tx.type === "income") {
        income += tx.amount;
      } else if (tx.type === "spend") {
        if (tx.amount >= th.orange) continue;
        if (tx.amount < MONO_MAX) continue;
        const dep = applyPoolDeposit(pool, tx.amount, th);
        pool = dep.pool;
        if (dep.tier) spawns += 1;
      }
    }
    return spawns;
  }

  /**
   * 연간 풀 방어 트로피 — 달별 win(풀 스폰 0) / fail / pending(이번 달) / future
   * 목표 지출선과 무관, 풀 실체화만 집계.
   */
  function deriveYearPoolBadges(transactions, year) {
    const y = year != null ? year : new Date().getFullYear();
    const now = new Date();
    const curYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const ym = `${y}-${mm}`;
      const txs = transactions.filter((t) => t.date && t.date.startsWith(ym));
      const spawns = countPoolSpawnsInTransactions(txs);

      let status;
      if (y > now.getFullYear() || ym > curYm) {
        status = "future";
      } else if (ym === curYm) {
        status = spawns === 0 ? "pending" : "fail";
      } else if (txs.length === 0) {
        status = "empty";
      } else {
        status = spawns === 0 ? "win" : "fail";
      }
      months.push({ month: m, ym, status, spawns });
    }

    const winCount = months.filter((x) => x.status === "win").length;
    return { year: y, months, winCount };
  }

  const POOL_TROPHY_STORAGE_KEY = "chick.poolTrophy.v1";

  function loadPoolTrophyStore() {
    try {
      const raw = localStorage.getItem(POOL_TROPHY_STORAGE_KEY);
      if (!raw) return { years: {} };
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && parsed.years ? parsed : { years: {} };
    } catch (_) {
      return { years: {} };
    }
  }

  function savePoolTrophyYear(year, badgeData) {
    try {
      const store = loadPoolTrophyStore();
      store.years[String(year)] = {
        months: badgeData.months.map(({ month, ym, status, spawns }) => ({
          month, ym, status, spawns,
        })),
        winCount: badgeData.winCount,
        updatedAt: Date.now(),
      };
      localStorage.setItem(POOL_TROPHY_STORAGE_KEY, JSON.stringify(store));
    } catch (_) {}
  }

  function getPoolTrophyYearsFromStore() {
    return Object.keys(loadPoolTrophyStore().years).map((y) => parseInt(y, 10)).filter(Boolean);
  }

  function collectBadgeYears(transactions) {
    const years = new Set([new Date().getFullYear()]);
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 4) years.add(parseInt(t.date.slice(0, 4), 10));
    });
    getPoolTrophyYearsFromStore().forEach((y) => years.add(y));
    return [...years].sort((a, b) => b - a);
  }

  /**
   * 거래 목록(createdAt 순)으로 보드·풀·합계·골라인·기절 상태를 처음부터 재계산.
   * 편집/삭제 후 호출 — 동일 거래면 항상 동일 보드.
   */
  function sumTxTotals(transactions) {
    let income = 0;
    let expense = 0;
    let savings = 0;
    for (const tx of transactions) {
      if (tx.type === "income") income += tx.amount;
      else if (tx.type === "spend") expense += tx.amount;
      else if (tx.type === "save") savings += tx.amount;
    }
    return { income, expense, savings };
  }

  function deriveGameState(transactions) {
    const sorted = [...transactions].sort((a, b) => a.createdAt - b.createdAt);
    const totals = sumTxTotals(sorted);
    /** ★ 부피·임계값은 항상 최종 수입 합계 기준 (거래 순서와 무관) */
    const volIncome = totals.income > 0 ? totals.income : DEFAULT_INCOME;
    const th = getThresholds(volIncome);

    let grid = makeBaseGrid();
    let pool = 0;
    let expense = 0;
    let savingsBucket = 0;

    for (const tx of sorted) {
      if (tx.type === "income") {
        continue;
      }
      if (tx.type === "save") {
        savingsBucket += tx.amount;
        const target = targetBoardCells(volIncome, expense, savingsBucket);
        const need = Math.max(0, target - countOccupiedCells(grid));
        grid = placeSaveVolume(grid, need, tx.amount, tx.id);
        grid = syncGridToTarget(grid, target, "save");
      } else if (tx.type === "spend") {
        expense += tx.amount;
        const target = targetBoardCells(volIncome, expense, savingsBucket);
        const need = Math.max(0, target - countOccupiedCells(grid));
        const label = tx.categorySub || "지출";
        const out = simSpend(grid, pool, tx.amount, label, th, tx.id, need);
        grid = syncGridToTarget(out.grid, target, "spend");
        pool = out.pool;
      }
    }

    const finalIncome = totals.income;
    const goalRowDyn = computeGoalRow();
    let ghostMode = isOverBudget(expense, finalIncome);
    if (!ghostMode) {
      for (let r = 0; r <= goalRowDyn; r++) {
        if (grid[r] && grid[r].some((c) => c && c.kind === "spend")) {
          ghostMode = true;
          break;
        }
      }
    }

    return {
      grid,
      pool,
      income: finalIncome,
      expense,
      savingsBucket,
      goalRow: goalRowDyn,
      ghostMode,
    };
  }
  /** 저축 O 블록 등 — 보드 가운데 스폰용 base pos.c */
  function centerColForShape(shape, rot) {
    const variants = SHAPES[shape];
    const cells = variants[(rot || 0) % variants.length];
    const cs = cells.map((p) => p[1]);
    const minC = Math.min(...cs);
    const w = Math.max(...cs) - minC + 1;
    return Math.max(0, Math.floor((COLS - w) / 2) - minC);
  }

  // 안전한 랜덤 컬럼: 블록이 보드 밖으로 나가지 않도록 보정
  function pickRandomCol(shape) {
    const cells = SHAPES[shape][0];
    const cs = cells.map((p) => p[1]);
    const minC = Math.min(...cs);
    const maxC = Math.max(...cs);
    const w = maxC - minC + 1;
    // 가능한 baseCol 범위: 0 ~ COLS - w
    const baseCol = Math.floor(Math.random() * (COLS - w + 1));
    return baseCol - minC; // active.pos.c 형태 (shape 셀 좌표는 minC만큼 더해짐)
  }

  // ── 스마트 배치 ──────────────────────────────────────────────
  // 지출 블록은 좌우 이동이 불가능하므로(handoff/01 비대칭 정책),
  // 실체화 시점에 "현재 보드가 가장 평평해지는" 컬럼을 골라 떨어뜨린다.
  // → 한쪽 쏠림 방지. 사용자는 회전만으로 미세 조정.
  function evalBoard(g) {
    const h = new Array(COLS).fill(0);
    let agg = 0, holes = 0, bump = 0, maxH = 0;
    for (let c = 0; c < COLS; c++) {
      let seen = false, height = 0, colHoles = 0;
      for (let r = 0; r < ROWS; r++) {
        if (g[r] && g[r][c]) {
          if (!seen) { seen = true; height = ROWS - r; }
        } else if (seen) {
          colHoles++;
        }
      }
      h[c] = height;
      agg += height;
      holes += colHoles;
      if (height > maxH) maxH = height;
    }
    for (let c = 0; c < COLS - 1; c++) bump += Math.abs(h[c] - h[c + 1]);
    return { agg, holes, bump, maxH };
  }

  // grid + 도형 + 회전 상태로 최적의 base pos.c 를 반환
  function pickSmartCol(grid, shape, rot) {
    const variants = SHAPES[shape];
    const cells = variants[(rot || 0) % variants.length];
    const cs = cells.map((p) => p[1]);
    const minC = Math.min(...cs);
    const maxC = Math.max(...cs);
    const w = maxC - minC + 1;

    let bestScore = Infinity;
    let bestPosC = -minC;
    let found = false;

    for (let base = 0; base <= COLS - w; base++) {
      const posC = base - minC;
      // 위에서 떨어뜨려 착지 행 계산
      let dr = 0;
      while (true) {
        const test = cells.map(([r, c]) => [r + dr + 1, c + posC]);
        const hit = test.some(
          ([r, c]) => r >= ROWS || c < 0 || c >= COLS || (grid[r] && grid[r][c])
        );
        if (hit) break;
        dr++;
      }
      const landed = cells.map(([r, c]) => [r + dr, c + posC]);
      // 스폰 지점에서 이미 막혀 있으면(보드 꼭대기 근처) 스킵
      if (landed.some(([r, c]) => r < 0 || r >= ROWS || (grid[r] && grid[r][c]))) continue;

      const tmp = grid.map((row) => row.slice());
      for (const [r, c] of landed) tmp[r][c] = { kind: "spend" };

      const { holes, bump, maxH } = evalBoard(tmp);
      const landingDepth = Math.max(...landed.map(([r]) => r)); // 깊을수록(아래) 골짜기 메움 = 좋음
      // 낮을수록 좋은 점수: 구멍 강하게 회피 > 평탄도 > 전체 높이 > 깊이 보너스
      const score = holes * 8 + bump * 1.4 + maxH * 1.1 - landingDepth * 0.55;

      if (score < bestScore) {
        bestScore = score;
        bestPosC = posC;
        found = true;
      }
    }
    return found ? bestPosC : pickRandomCol(shape);
  }

  const PIECE_QUEUE = [
    { shape: "T", kind: "spend", tier: "green",  amount:  78000, label: "외식·점심" },
    { shape: "L", kind: "spend", tier: "orange", amount: 184000, label: "쇼핑 — 옷" },
    { shape: "S", kind: "spend", tier: "cyan",   amount:  32000, label: "택시" },
    { shape: "O", kind: "spend", tier: "blue",   amount:   9500, label: "커피" },
    { shape: "J", kind: "spend", tier: "red",    amount: 528000, label: "월세 잔금" },
  ];

  // 즐겨찾기 📌 자동 표시 — 이 횟수 이상 사용 시 핀 노출
  const FAV_AUTO_PIN = 3;
  // 같은 금액·카테고리 직접 입력 N회 이상 → 즐겨찾기 저장 토글 자동 추천
  const FAV_SUGGEST_COUNT = 3;

  // 즐겨찾기 초기값 — 사용빈도 내림차순으로 정렬되어 노출됨
  const INITIAL_FAVORITES = [
    { id: "fs1", type: "spend",  label: "커피",     amount:    5_500, categoryTop: "RED",      categorySub: "커피",       usageCount: 24 },
    { id: "fs2", type: "spend",  label: "지하철",   amount:    1_450, categoryTop: "생활",     categorySub: "필수품",     usageCount: 18 },
    { id: "fs3", type: "spend",  label: "점심",     amount:   12_000, categoryTop: "생활",     categorySub: "외식",       usageCount: 15 },
    { id: "fs4", type: "spend",  label: "데이트",   amount:   58_000, categoryTop: "커플",     categorySub: "데이트비용", usageCount: 11 },
    { id: "fs5", type: "spend",  label: "넷플릭스", amount:   13_500, categoryTop: "구독",     categorySub: "OTT",        usageCount:  6 },
    { id: "fs6", type: "spend",  label: "사료",     amount:   45_000, categoryTop: "반려동물", categorySub: "사료",       usageCount:  4 },
    { id: "fi1", type: "income", label: "월급",     amount: 3_200_000, categoryTop: "수입",    categorySub: "급여",       usageCount:  1 },
    { id: "fi2", type: "income", label: "용돈",     amount:   100_000, categoryTop: "수입",    categorySub: "용돈",       usageCount:  3 },
    { id: "fv1", type: "save",   label: "비상금",   amount:    30_000, categoryTop: "저축",    categorySub: "비상금",     usageCount:  8 },
    { id: "fv2", type: "save",   label: "주택청약", amount:   100_000, categoryTop: "저축",    categorySub: "주택청약",   usageCount: 12 },
  ];

  // 9-카테고리 체계 (지출만 2-depth, 수입·저축은 평면)
  const CATEGORIES = {
    spend: {
      RED:       ["커피", "택시", "충동구매", "기타"],
      생활:      ["배달", "외식", "의료", "필수품", "장보기", "기타"],
      커플:      ["데이트비용", "기타"],
      고정:      ["통신", "보험", "기타"],
      주거:      ["월세", "대출이자", "기타"],
      자기개발:  ["취미", "건강", "미용", "기타"],
      특별:      ["이벤트", "여행", "경조사", "기타"],
      반려동물:  ["병원", "사료", "약값", "기타"],
      구독:      ["OTT", "멤버십", "기타"],
    },
    income: { 수입: ["급여", "용돈", "부수입", "환급", "기타"] },
    save:   { 저축: ["적금", "비상금", "투자", "주택청약", "기타"] },
  };

  // 카테고리 top → 분류 라벨 컬러 (게임 티어 컬러와 별개)
  const TOP_COLORS = {
    RED:      "#E54C5A",
    생활:     "#5BBE80",
    커플:     "#F08A4D",
    고정:     "#6E96FF",
    주거:     "#B4A0E8",
    자기개발: "#3FBBD8",
    특별:     "#FFD66B",
    반려동물: "#E89AB4",
    구독:     "#9DAEC4",
    수입:     "#B7C9FF",
    저축:     "#FFE899",
  };

  // 히스토리 없을 때 노출할 기본 빠른 칩 4개 (sub-카테고리, "기타" 제외) — 더보기 칩 자리 확보
  const DEFAULT_QUICK_SUBS = {
    spend: [
      { top: "RED",     sub: "커피" },
      { top: "생활",    sub: "배달" },
      { top: "커플",    sub: "데이트비용" },
      { top: "구독",    sub: "OTT" },
    ],
    income: [
      { top: "수입", sub: "급여" },
      { top: "수입", sub: "용돈" },
      { top: "수입", sub: "부수입" },
      { top: "수입", sub: "환급" },
    ],
    save: [
      { top: "저축", sub: "비상금" },
      { top: "저축", sub: "주택청약" },
      { top: "저축", sub: "적금" },
      { top: "저축", sub: "투자" },
    ],
  };

  const CHICK_BACKUP_VERSION = 1;
  const CHICK_STATE_STORAGE_KEY = "chick.state.v1";
  const CHICK_STATE_VERSION = 2;

  function normalizeTransactions(list, strict) {
    if (!Array.isArray(list)) {
      if (strict) throw new Error("거래 목록이 없어요.");
      return [];
    }
    return list.map((t, i) => {
      if (!t || typeof t !== "object") {
        if (strict) throw new Error(`거래 ${i + 1}번 형식 오류`);
        return null;
      }
      if (!t.id || !t.date || !t.type || typeof t.amount !== "number") {
        if (strict) throw new Error(`거래 ${i + 1}번에 필수 항목이 빠졌어요.`);
        return null;
      }
      return {
        id: String(t.id),
        date: String(t.date),
        type: t.type,
        amount: t.amount,
        categoryTop: t.categoryTop || "",
        categorySub: t.categorySub || "",
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
      };
    }).filter(Boolean);
  }

  /** localStorage 자동 저장용 — 새로고침 후 복원 */
  function loadChickPersistState() {
    try {
      const raw = localStorage.getItem(CHICK_STATE_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== CHICK_STATE_VERSION) return null;
      const transactions = normalizeTransactions(data.transactions, false);
      return {
        transactions,
        income: typeof data.income === "number" ? Math.max(0, data.income) : 0,
        savingsGoalPct: typeof data.savingsGoalPct === "number" ? data.savingsGoalPct : 20,
        favorites: Array.isArray(data.favorites) ? data.favorites : [],
      };
    } catch (_) {
      return null;
    }
  }

  function saveChickPersistState({ transactions, income, savingsGoalPct, favorites }) {
    try {
      localStorage.setItem(CHICK_STATE_STORAGE_KEY, JSON.stringify({
        version: CHICK_STATE_VERSION,
        savedAt: Date.now(),
        transactions: normalizeTransactions(transactions, false),
        income: typeof income === "number" ? Math.max(0, income) : 0,
        savingsGoalPct: typeof savingsGoalPct === "number" ? savingsGoalPct : 20,
        favorites: Array.isArray(favorites) ? favorites : [],
      }));
    } catch (_) {}
  }

  function buildChickBackup({ transactions, income, savingsGoalPct, theme, favorites }) {
    return {
      version: CHICK_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: "chick-block-ledger",
      data: {
        transactions: [...transactions],
        income,
        savingsGoalPct,
        theme,
        favorites: favorites ? [...favorites] : [],
      },
    };
  }

  function parseChickBackup(raw) {
    if (!raw || typeof raw !== "object") throw new Error("파일 형식이 올바르지 않아요.");
    if (raw.app && raw.app !== "chick-block-ledger") {
      throw new Error("병아리 블록 가계부 백업 파일이 아니에요.");
    }
    const data = raw.data || raw;
    const transactions = normalizeTransactions(data.transactions, true);
    return {
      transactions,
      income: typeof data.income === "number" ? data.income : DEFAULT_INCOME,
      savingsGoalPct: typeof data.savingsGoalPct === "number" ? data.savingsGoalPct : 20,
      theme: data.theme === "light" ? "light" : "dark",
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
    };
  }

  function escapeCsvCell(val) {
    const s = String(val ?? "");
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function transactionsToCSV(transactions) {
    const cols = ["id", "date", "type", "amount", "categoryTop", "categorySub", "createdAt"];
    const lines = [cols.join(",")];
    const sorted = [...transactions].sort((a, b) => a.createdAt - b.createdAt);
    sorted.forEach((t) => {
      lines.push(cols.map((c) => escapeCsvCell(t[c])).join(","));
    });
    return "\uFEFF" + lines.join("\r\n");
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function backupFilename(ext) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `chick-backup-${stamp}.${ext}`;
  }

  return {
    COLS, ROWS, CELL, GAP, GOAL_ROW, SPAWN, SAVE_TONE, TIER, SHAPES,
    makeInitGrid, makeLandingHeroGrid, makeEmptyHomePreviewGrid, makeBaseGrid, deriveGameState, sumTxTotals, deriveYearPoolBadges, countPoolSpawnsInTransactions,
    loadPoolTrophyStore, savePoolTrophyYear, collectBadgeYears, POOL_TROPHY_STORAGE_KEY, PIECE_QUEUE,
    CHICK_BACKUP_VERSION, CHICK_STATE_STORAGE_KEY, loadChickPersistState, saveChickPersistState,
    buildChickBackup, parseChickBackup, transactionsToCSV, downloadTextFile, backupFilename,
    TARGET_SPEND_RATIO, getTargetSpend, isOverBudget,
    TIER_THRESHOLD, TIER_RATIO, POOL_TIER_ORDER, getThresholds, applyPoolDeposit, DEFAULT_INCOME, SHAPE_BY_TIER, TIER_HINT_LABEL, pickShapeFor, pickRandomCol, pickSmartCol, centerColForShape,
    MONO_MAX, MONO_RED, monoSubtype, pickFillCell, hardenFullRows,
    countOccupiedCells, targetBoardCells, AVG_CELLS_PER_BLOCK, computeGoalRow,
    FAV_AUTO_PIN, FAV_SUGGEST_COUNT, INITIAL_FAVORITES, CATEGORIES, TOP_COLORS, DEFAULT_QUICK_SUBS,
  };
})();
