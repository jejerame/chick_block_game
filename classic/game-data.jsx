/* global React */

// ── BOARD CONSTANTS ────────────────────────────────────────────────
window.GAME = (() => {
  const COLS = 8;
  const ROWS = 16;
  const CELL = 22;
  const GAP  = 1;
  const GOAL_ROW = 5;        // rows 0..4 = danger zone, line sits at top of row 5
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

  // ── POOL SYSTEM ──────────────────────────────────────────────
  // 풀이 임계 금액을 넘는 순간 해당 티어의 블록이 자동 실체화 + 낙하한다.
  // ★ 임계값은 수입 비례. getThresholds(income) 로 동적 계산.
  //   cyan = 수입의 1.5%, green = 3%, orange = 15% (만 단위 반올림)
  const TIER_RATIO = { cyan: 0.015, green: 0.03, orange: 0.15 };
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
      const score = holes * 6 + bump * 1.3 + maxH * 0.9 - landingDepth * 0.4;

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

  return {
    COLS, ROWS, CELL, GAP, GOAL_ROW, SPAWN, SAVE_TONE, TIER, SHAPES,
    makeInitGrid, PIECE_QUEUE,
    TIER_THRESHOLD, TIER_RATIO, getThresholds, SHAPE_BY_TIER, TIER_HINT_LABEL, pickShapeFor, pickRandomCol, pickSmartCol,
    MONO_MAX, MONO_RED, monoSubtype, pickFillCell, hardenFullRows,
    INITIAL_FAVORITES, CATEGORIES, TOP_COLORS, DEFAULT_QUICK_SUBS,
  };
})();
