/* global React, ReactDOM, GAME, IOSDevice */
(function(){
const { useState, useEffect, useMemo, useCallback, useRef } = React;

const {
  COLS, ROWS, CELL, GAP, GOAL_ROW: INIT_GOAL_ROW, SPAWN, SHAPES,
  makeInitGrid,
  getThresholds, TIER_HINT_LABEL, pickShapeFor, pickRandomCol, pickSmartCol,
  MONO_MAX, monoSubtype, pickFillCell, hardenFullRows,
  INITIAL_FAVORITES,
} = window.GAME;

const AUTO_FALL_MS = 700; // 자동 낙하 간격

function App() {
  // ── TWEAKS ──────────────────────────────────────────────
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "ghostPreview": false,
    "theme": "dark"
  }/*EDITMODE-END*/;
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // ── THEME (다크/라이트) ──────────────────────────────────────
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem("chick.theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) {}
    return tweaks.theme === "light" ? "light" : "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("chick.theme", theme); } catch (_) {}
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    setTweak("theme", next);
  };

  // ── SCREEN ROUTING (home / stats / me) ──────────────────────
  const [screen, setScreen] = useState("home");

  // ── SETTINGS (목표 저축률 등) ────────────────────────────────
  const [savingsGoalPct, setSavingsGoalPct] = useState(20);

  // ── STATE ────────────────────────────────────────────────────
  const [grid, setGrid] = useState(makeInitGrid);

  // Pool 시스템: 자잘 지출이 합산되는 공중 풀
  const [pool, setPool] = useState(28_500); // 시드값 (커피 + 편의점 누적)

  // 활성 블록 — null이면 보드에 떨어지는 블록 없음 (풀 채우는 중)
  const [active, setActive] = useState(null);
  // 대기열: 풀 임계 도달 시 여러 블록이 한 번에 발생 가능 → FIFO로 순차 스폰
  const [spawnQueue, setSpawnQueue] = useState([]);

  // 동적 income / expense / saving
  const [income, setIncome]   = useState(3_200_000);
  const [expense, setExpense] = useState(1_840_000);

  // ★ 수입 비례 임계값 — income 바뀔 때마다 재계산
  const TIER_THRESHOLD = useMemo(() => getThresholds(income), [income]);

  // 수입 직접 설정 (프로필 슬라이더용) — goalRow도 비례 재배치
  const setIncomeDirect = (next) => {
    setIncome(next);
    // 수입↑ → 골 라인이 위로 올라감 (지출 한도가 너그러워짐)
    // 단순 비례: goalRow = floor(ROWS * 0.31 * (3_200_000 / income))
    // 기준 320만일 때 약 5행, 600만일 때 약 2~3행, 150만일 때 약 10행
    const baseRatio = 5 / 3_200_000; // 기준점
    const target = Math.max(2, Math.min(13, Math.round(baseRatio * 3_200_000 * (3_200_000 / Math.max(1, next)))));
    setGoalRow(target);
    setGoalBouncing(true);
    setTimeout(() => setGoalBouncing(false), 600);
  };

  // 동적 골 라인 — income 증가 시 위로 올라감
  const [goalRow, setGoalRow] = useState(INIT_GOAL_ROW);
  const [goalBouncing, setGoalBouncing] = useState(false);

  const [rescueAvailable, setRescueAvailable] = useState(1);
  const [ghostMode, setGhostMode] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [floatToast, setFloatToast] = useState(null); // 실체화 토스트
  const [monoFlash, setMonoFlash] = useState(null);    // 낱알 착지 반짝
  const [hardenRows, setHardenRows] = useState([]);    // 방금 굳은 줄 (흔들림 연출)
  const [hardenToast, setHardenToast] = useState(null); // 굳음 안내 토스트

  // 입력 바텀시트 + 즐겨찾기
  const [sheetType, setSheetType] = useState(null); // null | "spend" | "income" | "save"
  const [favorites, setFavorites] = useState(INITIAL_FAVORITES);
  // 저축 = 사용자가 명시적으로 적립한 금액만 (★ 잔여금은 저축이 아님 — 비대칭 정책)
  // 초기값: 시드 거래의 save 타입 합계 (t10 10만 + t11 3만 = 13만)
  const [savingsBucket, setSavingsBucket] = useState(130_000);

  // 거래 내역 (수정/삭제 가능)
  const [transactions, setTransactions] = useState([
    { id: "t01", date: "2026-05-26", type: "spend",  amount:    5_500, categoryTop: "RED",      categorySub: "커피",       createdAt: 1716700000000 },
    { id: "t02", date: "2026-05-26", type: "spend",  amount:   12_000, categoryTop: "생활",     categorySub: "외식",       createdAt: 1716710000000 },
    { id: "t03", date: "2026-05-26", type: "spend",  amount:   22_000, categoryTop: "생활",     categorySub: "배달",       createdAt: 1716720000000 },
    { id: "t04", date: "2026-05-25", type: "spend",  amount:   58_000, categoryTop: "커플",     categorySub: "데이트비용", createdAt: 1716620000000 },
    { id: "t05", date: "2026-05-25", type: "spend",  amount:    4_200, categoryTop: "RED",      categorySub: "충동구매",   createdAt: 1716625000000 },
    { id: "t06", date: "2026-05-24", type: "spend",  amount:  620_000, categoryTop: "주거",     categorySub: "월세",       createdAt: 1716540000000 },
    { id: "t07", date: "2026-05-24", type: "spend",  amount:   13_500, categoryTop: "구독",     categorySub: "OTT",        createdAt: 1716544000000 },
    { id: "t08", date: "2026-05-23", type: "spend",  amount:   45_000, categoryTop: "반려동물", categorySub: "사료",       createdAt: 1716450000000 },
    { id: "t09", date: "2026-05-22", type: "income", amount: 3_200_000, categoryTop: "수입",   categorySub: "급여",       createdAt: 1716360000000 },
    { id: "t10", date: "2026-05-22", type: "save",   amount:  100_000, categoryTop: "저축",     categorySub: "적금",       createdAt: 1716365000000 },
    { id: "t11", date: "2026-05-20", type: "save",   amount:   30_000, categoryTop: "저축",     categorySub: "비상금",     createdAt: 1716180000000 },
  ]);

  // 거래 리스트 시트 + 편집 모드
  const [listSheetOpen, setListSheetOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null); // 편집 중인 트랜잭션 객체

  // ── COMPUTED ────────────────────────────────────────────────
  const activeCells = useMemo(() => {
    if (!active) return [];
    const variants = SHAPES[active.shape];
    const shape = variants[active.rot % variants.length];
    return shape.map(([r, c]) => [active.pos.r + r, active.pos.c + c]);
  }, [active]);

  const collides = useCallback(
    (cells) =>
      cells.some(
        ([r, c]) => r < 0 || r >= ROWS || c < 0 || c >= COLS || (grid[r] && grid[r][c])
      ),
    [grid]
  );

  const ghostCells = useMemo(() => {
    if (!active) return [];
    const variants = SHAPES[active.shape];
    const shape = variants[active.rot % variants.length];
    let dr = 0;
    while (true) {
      const test = shape.map(([r, c]) => [active.pos.r + dr + 1 + r, active.pos.c + c]);
      if (collides(test)) break;
      dr++;
    }
    return shape.map(([r, c]) => [active.pos.r + dr + r, active.pos.c + c]);
  }, [active, collides]);

  // 다음 임계까지 남은 금액
  const nextThreshold = useMemo(() => {
    const order = ["cyan", "green", "orange"];
    for (const t of order) {
      if (pool < TIER_THRESHOLD[t]) return { tier: t, value: TIER_THRESHOLD[t] };
    }
    return { tier: "orange", value: TIER_THRESHOLD.orange };
  }, [pool]);

  // ── HELPERS ──────────────────────────────────────────────────
  const makeBlock = (tier, amount, label) => {
    const shape = pickShapeFor(tier);
    const col = pickRandomCol(shape);
    return {
      shape, kind: "spend", tier,
      amount, label,
      pos: { r: 0, c: col },
      rot: 0,
      auto: true,
    };
  };

  const showToast = (tier, label) => {
    setFloatToast({ tier, label, t: Date.now() });
    setTimeout(() => setFloatToast(null), 1400);
  };

  // ── SPEND / INCOME HANDLERS ─────────────────────────────────
  const onSpend = (amount, label = "지출") => {
    setExpense((e) => e + amount);

    // 1) 단일 큰 거래 → 즉시 red short-circuit
    if (amount >= TIER_THRESHOLD.orange) {
      const blk = makeBlock("red", amount, label);
      setSpawnQueue((q) => [...q, blk]);
      showToast("red", label);
      return;
    }

    // 2) ★ 소액(< 2만) → 풀을 거치지 않고 1×1 낱알을 즉시 자동 끝워넣기
    //    < 1만 → 기절한 흰 병아리, 1만~2만 → 빨간 병아리
    if (amount < MONO_MAX) {
      dropMono(amount, label);
      return;
    }

    // 3) 중간대(2만~48만) → 풀 누적 + carry-over 처리
    setPool((p) => {
      let cur = p + amount;
      const newBlocks = [];
      // 가장 높이 넘은 티어 1개를 떨어뜨리고 차감, 반복
      while (true) {
        let crossedTier = null;
        // 큰 티어부터 검사 → 가장 큰 임계 1개를 골라 차감
        for (const t of ["orange", "green", "cyan"]) {
          if (cur >= TIER_THRESHOLD[t]) { crossedTier = t; break; }
        }
        if (!crossedTier) break;
        const th = TIER_THRESHOLD[crossedTier];
        newBlocks.push(makeBlock(crossedTier, th, TIER_HINT_LABEL[crossedTier]));
        cur -= th;
      }
      if (newBlocks.length) {
        setSpawnQueue((q) => [...q, ...newBlocks]);
        showToast(newBlocks[newBlocks.length - 1].tier, newBlocks[newBlocks.length - 1].label);
      }
      return cur;
    });
  };

  // ★ 굳히기 — 꽉 찬 지출 줄을 회색으로 굳힘. 새로 굳은 줄이 있으면 흔들림+토스트.
  const applyHarden = (g) => {
    const { grid: hg, newlyHardened } = hardenFullRows(g);
    if (newlyHardened.length) {
      setHardenRows(newlyHardened);
      setHardenToast({ t: Date.now() });
      setTimeout(() => setHardenRows([]), 650);
      setTimeout(() => setHardenToast(null), 1600);
    }
    return hg;
  };

  // ★ 낱알(모노) 즉시 드롭 — 풀/큐/활성블록 없이 보드에 바로 끝워넣음
  const dropMono = (amount, label) => {
    const subtype = monoSubtype(amount);
    setGrid((g) => {
      const cell = pickFillCell(g);
      if (!cell) return g; // 보드 가득 — 드롭 스킵
      const [r, c] = cell;
      const ng = g.map((row) => row.slice());
      ng[r][c] = { kind: "spend", tier: "blue", mono: true, subtype, amount };
      setMonoFlash({ r, c, subtype, t: Date.now() });
      return applyHarden(ng);
    });
    flashPulse();
  };

  const onIncome = (amount) => {
    setIncome((i) => i + amount);
    // 골 라인을 위로 1행 ↑ (clamp 0)
    setGoalRow((g) => Math.max(0, g - 1));
    setGoalBouncing(true);
    setTimeout(() => setGoalBouncing(false), 600);
  };

  const onSaveAdd = (amount, label) => {
    setSavingsBucket((s) => s + amount);
    // 저축은 expense를 늘리지 않고 자체 버킷에만 누적 — 헤더 칩에 합산
    // (저축 블록 수동 배치는 별도 작업)
  };

  // 바텀시트 제출 처리
  const handleSheetSubmit = ({ type, amount, categoryTop, categorySub, fromFavorite, saveAsFav }) => {
    const catLabel = categorySub || "기타";

    // 편집 모드인 경우 — 기존 거래 갱신 (보드 recompute는 Cursor 영역)
    if (editingTx) {
      setTransactions((ts) => ts.map((t) =>
        t.id === editingTx.id
          ? { ...t, amount, categoryTop, categorySub: catLabel }
          : t
      ));
      // 금액 차이만큼 합계 보정
      const diff = amount - editingTx.amount;
      if (type === "spend")  setExpense((e) => e + diff);
      if (type === "income") setIncome((i) => i + diff);
      if (type === "save")   setSavingsBucket((s) => s + diff);
      setEditingTx(null);
      setSheetType(null);
      return;
    }

    // 신규 거래
    if (type === "spend")  onSpend(amount, catLabel);
    if (type === "income") onIncome(amount);
    if (type === "save")   onSaveAdd(amount, catLabel);

    // 거래 내역에 추가
    setTransactions((ts) => [
      ...ts,
      {
        id: `t_${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        type, amount, categoryTop, categorySub: catLabel,
        createdAt: Date.now(),
      },
    ]);

    // 즐겨찾기 사용횟수 +1 또는 신규 즐겨찾기 등록
    if (fromFavorite) {
      setFavorites((fs) => fs.map((f) =>
        f.id === fromFavorite ? { ...f, usageCount: f.usageCount + 1 } : f
      ));
    } else if (saveAsFav && categorySub && categorySub !== "기타") {
      setFavorites((fs) => [
        ...fs,
        {
          id: `f_${Date.now()}`,
          type, amount, categoryTop, categorySub,
          label: categorySub,
          usageCount: 1,
        },
      ]);
    }
    setSheetType(null);
  };

  // 거래 삭제 (편집 시트의 🗑️ 버튼)
  const handleDeleteTransaction = (id) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    // 합계에서 차감
    if (tx.type === "spend")  setExpense((e) => Math.max(0, e - tx.amount));
    if (tx.type === "income") setIncome((i) => Math.max(0, i - tx.amount));
    if (tx.type === "save")   setSavingsBucket((s) => Math.max(0, s - tx.amount));
    setTransactions((ts) => ts.filter((t) => t.id !== id));
    setEditingTx(null);
    setSheetType(null);
  };

  // 거래 리스트에서 항목 탭 → 편집 모드 진입
  const openEditTransaction = (tx) => {
    setEditingTx(tx);
    setSheetType(tx.type);
    setListSheetOpen(false);
  };

  // ── ACTIONS (회전 + DROP만 — 좌우 이동 제거) ─────────────────
  const tryMove = (dr, dc, drot) => {
    if (!active) return false;
    const variants = SHAPES[active.shape];
    const newRot = (active.rot + (drot || 0) + variants.length) % variants.length;
    const shape = variants[newRot];
    const newPos = { r: active.pos.r + dr, c: active.pos.c + dc };
    const newCells = shape.map(([r, c]) => [newPos.r + r, newPos.c + c]);
    if (!collides(newCells)) {
      setActive({ ...active, pos: newPos, rot: newRot });
      return true;
    }
    return false;
  };

  const onRotate = () => { if (tryMove(0, 0, 1)) flashPulse(); };
  const onSoftDrop = () => tryMove(1, 0, 0);

  const lockActive = useCallback(() => {
    if (!active) return;
    const variants = SHAPES[active.shape];
    const shape = variants[active.rot % variants.length];
    let dr = 0;
    while (true) {
      const test = shape.map(([r, c]) => [active.pos.r + dr + 1 + r, active.pos.c + c]);
      if (test.some(([r, c]) => r >= ROWS || c < 0 || c >= COLS || (grid[r] && grid[r][c]))) break;
      dr++;
    }
    const landed = shape.map(([r, c]) => [active.pos.r + dr + r, active.pos.c + c]);
    const newGrid = grid.map((row) => row.slice());
    landed.forEach(([r, c]) => {
      if (r >= 0 && r < ROWS) {
        newGrid[r][c] = { kind: "spend", tier: active.tier, amount: active.amount };
      }
    });
    if (landed.some(([r]) => r <= goalRow)) {
      setGhostMode(true);
    }
    setGrid(applyHarden(newGrid));
    setActive(null);
  }, [active, grid, goalRow]);

  const onDrop = () => lockActive();

  const flashPulse = () => {
    setPulse(true);
    setTimeout(() => setPulse(false), 120);
  };

  const onRescue = () => {
    if (rescueAvailable <= 0) return;
    let target = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every((c) => c && c.kind === "save")) { target = r; break; }
    }
    if (target < 0) return;
    const newGrid = grid.map((row) => row.slice());
    newGrid.splice(target, 1);
    newGrid.unshift(Array(COLS).fill(null));
    setGrid(newGrid);
    setRescueAvailable(rescueAvailable - 1);
    setGhostMode(false);
  };

  // ── AUTO SPAWN: 큐에 블록이 있고 활성이 없으면 꺼내서 활성화 ──
  useEffect(() => {
    if (!active && spawnQueue.length > 0) {
      const [head, ...rest] = spawnQueue;
      // ★ 스폰 시점의 실제 보드로 가장 평평해지는 컬럼 재계산 (쏠림 방지)
      const smartC = pickSmartCol(grid, head.shape, head.rot || 0);
      setSpawnQueue(rest);
      setActive({ ...head, pos: { ...head.pos, c: smartC } });
    }
  }, [active, spawnQueue, grid]);

  // ── AUTO FALL: 활성 블록은 주기적으로 자동 낙하 ─────────────
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const variants = SHAPES[active.shape];
      const shape = variants[active.rot % variants.length];
      const newCells = shape.map(([r, c]) => [active.pos.r + 1 + r, active.pos.c + c]);
      const blocked = newCells.some(
        ([r, c]) => r >= ROWS || c < 0 || c >= COLS || (grid[r] && grid[r][c])
      );
      if (blocked) {
        lockActive();
      } else {
        setActive((a) => a ? { ...a, pos: { r: a.pos.r + 1, c: a.pos.c } } : a);
      }
    }, AUTO_FALL_MS);
    return () => clearInterval(id);
  }, [active, grid, lockActive]);

  // ── KEYBOARD: 회전, DROP만 ──────────────────────────────────
  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowUp")    { e.preventDefault(); onRotate(); }
      if (e.key === " ")          { e.preventDefault(); onDrop(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  // top expenses
  const topExpenses = [
    { cat: "외식·배달",   amount: 482000, tier: "orange" },
    { cat: "구독·멤버십", amount: 318000, tier: "orange" },
    { cat: "택시·교통",   amount: 246000, tier: "green"  },
  ];

  const effectiveGhost = ghostMode || tweaks.ghostPreview;

  const EGG_GOAL = 18;
  // ★ 저축 = 사용자가 의식적으로 적립한 금액(savingsBucket)만.
  // 지출을 입력해도 저축 수치는 동요하지 않는다. "쓰고 남은 잔여"는 저축이 아니다.
  const effectiveSaving = savingsBucket;
  // 여유금(잔여): 수입−지출−저축 — 필요 시 별도 지표로 노출
  const freeCash = Math.max(0, income - expense - savingsBucket);
  const savePct  = Math.max(0, Math.min(100, Math.round(effectiveSaving / income * 100)));
  const angerPct = Math.max(0, Math.min(100, Math.round(expense / income * 100)));
  const derivedEggs = Math.max(
    0,
    Math.min(EGG_GOAL, Math.round((effectiveSaving / income) * EGG_GOAL) - (1 - rescueAvailable))
  );

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div className="page-bg">
      <div className="phone-cradle">
        <window.IOSDevice dark={true} width={402} height={874}>
          <div className="app-shell">
            <div className="status-spacer" />
            <window.AppHeader
              income={income}
              expense={expense}
              saving={effectiveSaving}
              ghostMode={effectiveGhost}
              onChipTap={(t) => setSheetType(t)}
            />

            {screen === "home" && (
            <div className="game-zone">
              <window.EggCartonPanel
                eggs={derivedEggs}
                goal={EGG_GOAL}
                savePct={savePct}
                theme={theme}
                onToggleTheme={toggleTheme}
              />

              <div className="board-wrap">
                <window.PoolZone pool={pool} nextThreshold={nextThreshold} toast={floatToast} />
                <window.Board
                  grid={grid}
                  active={active}
                  activeCells={activeCells}
                  ghostCells={ghostCells}
                  ghostMode={effectiveGhost}
                  pulse={pulse}
                  goalRow={goalRow}
                  goalBouncing={goalBouncing}
                  monoFlash={monoFlash}
                  hardenRows={hardenRows}
                  hardenToast={hardenToast}
                />
              </div>

              <window.AngerRoomPanel
                angerPct={angerPct}
                topExpenses={topExpenses}
                onOpenList={() => setListSheetOpen(true)}
              />
            </div>
            )}

            {screen === "stats" && (
              <window.StatsScreen
                transactions={transactions}
                income={income}
                expense={expense}
              />
            )}

            {screen === "me" && (
              <window.ProfileScreen
                income={income}
                onIncomeChange={setIncomeDirect}
                savingsGoalPct={savingsGoalPct}
                onSavingsGoalChange={setSavingsGoalPct}
                totalEggs={derivedEggs}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            )}

            {screen === "home" && (
            <window.Controls
              active={active}
              pool={pool}
              nextThreshold={nextThreshold}
              onRotate={onRotate}
              onDrop={onDrop}
              onRescue={onRescue}
              rescueAvailable={rescueAvailable}
            />
            )}

            <window.BottomNav
              ghostMode={effectiveGhost}
              screen={screen}
              onSelect={setScreen}
            />

            {sheetType && (
              <window.BottomSheet
                type={sheetType}
                favorites={favorites}
                onClose={() => { setSheetType(null); setEditingTx(null); }}
                onSubmit={handleSheetSubmit}
                editing={editingTx}
                onDelete={handleDeleteTransaction}
              />
            )}

            {listSheetOpen && (
              <window.TransactionListSheet
                transactions={transactions}
                onClose={() => setListSheetOpen(false)}
                onEdit={openEditTransaction}
              />
            )}
          </div>
        </window.IOSDevice>

        {/* side caption */}
        <div className="caption">
          <div className="cap-title">병아리 블록 가계부 — Pool v2</div>
          <div className="cap-sub">공중 부양 합산 시스템 · 자동 낙하 데모</div>
          <ul className="cap-list">
            <li>상단 <b>수입/지출/저축 칩</b> 탭 → 바텀시트 입력</li>
            <li>시트 상단 <b>★ 즐겨찾기</b> 칩 1탭으로 즉시 입력</li>
            <li>지출 입력 → 풀에 누적 / 임계 도달 시 자동 낙하</li>
            <li>낙하 중 <b>↑</b> 회전 / <b>SPACE</b> 즉시 드롭만</li>
            <li><b>수입 +</b> → 목표 지출선 한 칸 위로 bounce</li>
            <li>📌 한 줄이 차도 <b>절대 클리어되지 않음</b></li>
          </ul>
        </div>
      </div>

      <window.TweaksPanel title="병아리 블록 Tweaks">
        <window.TweakSection label="미리보기">
          <window.TweakToggle
            label="👻 기절 모드 (목표선 초과)"
            value={tweaks.ghostPreview}
            onChange={(v) => setTweak("ghostPreview", v)}
          />
        </window.TweakSection>
      </window.TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
