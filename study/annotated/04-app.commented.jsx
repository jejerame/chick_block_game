/*
╔══════════════════════════════════════════════════════════════════╗
║  app.jsx — 학습용 주석판 (원본: 루트/app.jsx)                    ║
╠══════════════════════════════════════════════════════════════════╣
║  【이 파일의 역할】                                               ║
║  React "지휘본부". 화면에 보이는 상태를 들고, 사용자 입력을 받음. ║
║  - transactions = 가계부 거래 목록 (진짜 데이터)                  ║
║  - grid, pool, active, spawnQueue = 게임 화면 상태                ║
║                                                                  ║
║  ★ 버그가 많이 난 이유 ★                                          ║
║  deriveGameState(정답) 와 lockActive/dropMono(연출) 두 갈래가      ║
║  동시에 grid를 바꿔서 숫자와 화면이 어긋남.                       ║
║                                                                  ║
║  【읽는 순서 추천】                                               ║
║  1) useState 목록 (grid, pool, transactions…)                    ║
║  2) handleSheetSubmit — 지출/수입/저축 입력                       ║
║  3) queueSpendBlocks, dropMono, lockActive                       ║
║  4) useEffect (큐, 자동낙하, DROP세션 끝 동기화)                  ║
╚══════════════════════════════════════════════════════════════════╝
*/

/* global React, ReactDOM, GAME, IOSDevice */
(function(){
// React 훅 — 화면이 바뀔 때 다시 그리게 해 주는 도구들
const { useState, useEffect, useMemo, useCallback, useRef } = React;

const {
  COLS, ROWS, CELL, GAP, SPAWN, SHAPES,
  makeLandingHeroGrid, makeEmptyHomePreviewGrid, deriveGameState, sumTxTotals, deriveYearPoolBadges, savePoolTrophyYear, collectBadgeYears,
  loadChickPersistState, saveChickPersistState,
  buildChickBackup, parseChickBackup, transactionsToCSV, downloadTextFile, backupFilename,
  getThresholds, getTargetSpend, isOverBudget, TIER_HINT_LABEL, applyPoolDeposit, pickShapeFor, pickRandomCol, pickSmartCol,
  MONO_MAX, monoSubtype, pickFillCell, hardenFullRows, countOccupiedCells, AVG_CELLS_PER_BLOCK, computeGoalRow, gridSpendPastGoalRow, cellDeltaFromTxChange, simulateSpendStep,
  INITIAL_FAVORITES, DEFAULT_INCOME,
// ↑ game-data.jsx 가 만든 window.GAME 에서 필요한 함수만 꺼냄
} = window.GAME;

const EMPTY_GHOST_KEY = "chick.seenEmptyGhost";
const EMPTY_GHOST_FADE_MS = 520;
/** 고스트가 그려진 뒤에만 첫 터치로 닫기 (랜딩 클릭·자동 pointerdown 오인 방지) */
/** 랜딩 직후 빈 홈 데모 — 시작하기 터치와 겹치지 않게 랜딩 닫힌 뒤에만 무장 */
const EMPTY_GHOST_ARM_MS = 1200;

function loadEmptyGhostSeen() {
  try { return localStorage.getItem(EMPTY_GHOST_KEY) === "1"; } catch (_) { return false; }
}

// 블록이 0.85초마다 한 칸씩 아래로 (자동 낙하)
const AUTO_FALL_MS = 850; // 자동 낙하 간격 (포화 체감 완화)

/** 실사용 기본값 — 거래 없음(즐겨찾기 시드만 INITIAL_FAVORITES) */
// 처음엔 거래 없음 (빈 가계부)
const INITIAL_TRANSACTIONS = [];

const INITIAL_DERIVED = deriveGameState(INITIAL_TRANSACTIONS);

function sumIncomeTxs(txs) {
  return txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
}

/** persist income 필드 ↔ 수입 거래 1건 동기화 (createdAt=0 → 부피 계산에 항상 반영) */
function ensureIncomeTransaction(transactions, incomeHint) {
  const fromTxs = sumIncomeTxs(transactions);
  const amount = fromTxs > 0 ? fromTxs : (incomeHint > 0 ? incomeHint : 0);
  if (amount <= 0) return transactions;
  const rest = transactions.filter((t) => t.type !== "income");
  const prev = transactions.find((t) => t.type === "income");
  return [
    ...rest,
    {
      id: prev?.id ?? "t_income",
      date: prev?.date ?? new Date().toISOString().slice(0, 10),
      type: "income",
      amount,
      categoryTop: "수입",
      categorySub: prev?.categorySub ?? "급여",
      createdAt: prev?.createdAt ?? 0,
    },
  ];
}

function sanitizeFavorites(favs) {
  return favs.filter(
    (f) => f.id !== "fi1" && !(f.type === "income" && f.amount === 3_200_000 && f.label === "월급")
  );
}


/* 【앱 켤 때】 localStorage 있으면 복원, 없으면 빈 상태 */
function bootAppState() {
  const saved = loadChickPersistState();
  if (saved) {
    const transactions = ensureIncomeTransaction(saved.transactions, saved.income);
    const derived = deriveGameState(transactions);
    return {
      transactions,
      favorites: sanitizeFavorites(saved.favorites.length ? saved.favorites : INITIAL_FAVORITES),
      savingsGoalPct: saved.savingsGoalPct,
      derived,
    };
  }
  return {
    transactions: INITIAL_TRANSACTIONS,
    favorites: sanitizeFavorites(INITIAL_FAVORITES),
    savingsGoalPct: 20,
    derived: INITIAL_DERIVED,
  };
}

const BOOT = bootAppState();

/** PC 데모 = iOS 프레임(402×874). 실제 폰 Safari = 프레임 없이 풀스크린 */
const NATIVE_DEVICE_MQ = "(max-width: 520px)";

function useNativeDevice() {
  const [native, setNative] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(NATIVE_DEVICE_MQ).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(NATIVE_DEVICE_MQ);
    const root = document.documentElement;
    const syncVv = () => {
      const vv = window.visualViewport;
      const h = vv ? vv.height : window.innerHeight;
      root.style.setProperty("--vv-h", `${h}px`);
      root.style.setProperty("--vv-top", `${vv ? vv.offsetTop : 0}px`);
    };
    const apply = () => {
      const on = mq.matches;
      setNative(on);
      root.classList.toggle("native-device", on);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
      root.classList.toggle("is-standalone", standalone);
      root.classList.toggle("is-safari-browser", on && !standalone);
      syncVv();
    };
    apply();
    mq.addEventListener("change", apply);
    window.visualViewport?.addEventListener("resize", syncVv);
    window.visualViewport?.addEventListener("scroll", syncVv);
    window.addEventListener("resize", syncVv);
    return () => {
      mq.removeEventListener("change", apply);
      window.visualViewport?.removeEventListener("resize", syncVv);
      window.visualViewport?.removeEventListener("scroll", syncVv);
      window.removeEventListener("resize", syncVv);
      root.classList.remove("native-device", "is-standalone", "is-safari-browser");
    };
  }, []);
  return native;
}


/* 【메인 앱】 전체 화면을 그리는 큰 함수 */
function App() {
  const nativeDevice = useNativeDevice();
  // ── TWEAKS ──────────────────────────────────────────────
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "ghostPreview": false,
    "theme": "dark",
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
  // 마스코트 탭 → 밤 ↔ 낮 토글
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    setTweak("theme", next);
  };
  // 특정 테마로 직접 지정 (프로필 셀렉터용)
  const setTheme = (next) => {
    setThemeState(next);
    setTweak("theme", next);
  };

  // ── SCREEN ROUTING (home / stats / me) ──────────────────────
  const [screen, setScreen] = useState("home");

  // ── LANDING (첫 실행만) ──────────────────────────────────────
  const [showLanding, setShowLanding] = useState(() => {
    try { return localStorage.getItem("chick.seenLanding") !== "1"; } catch (_) { return true; }
  });
  const [landingClosing, setLandingClosing] = useState(false);
  const [landingSession, setLandingSession] = useState(0);
  const startGuardRef = useRef(0);
  const startApp = useCallback(() => {
    const now = Date.now();
    if (now - startGuardRef.current < 350) return;
    startGuardRef.current = now;
    try { localStorage.setItem("chick.seenLanding", "1"); } catch (_) {}
    document.querySelectorAll(".landing").forEach((el) => {
      el.classList.add("landing--gone");
    });
    setShowLanding(false);
    setLandingClosing(false);
  }, []);
  const replayLanding = () => {
    setLandingClosing(false);
    setScreen("home");
    setLandingSession((n) => n + 1);
    setShowLanding(true);
  };

  const [forceEmptyPreview, setForceEmptyPreview] = useState(false);

  const replayEmptyPreview = () => {
    try { localStorage.removeItem(EMPTY_GHOST_KEY); } catch (_) {}
    setEmptyGhostSeen(false);
    setEmptyGhostFading(false);
    emptyGhostDismissLock.current = false;
    setForceEmptyPreview(true);
    setScreen("home");
  };

  // ── SETTINGS (목표 저축률 등) ────────────────────────────────
  const [savingsGoalPct, setSavingsGoalPct] = useState(BOOT.savingsGoalPct);

  // ── STATE ────────────────────────────────────────────────────
    // grid = 보드에 박힌 병아리들 2차원 배열
const [grid, setGrid] = useState(BOOT.derived.grid);

  // Pool 시스템: 자잘 지출이 합산되는 공중 풀
    // pool = 공중에 떠 있는 자잘한 지출 합계(원)
const [pool, setPool] = useState(BOOT.derived.pool);

  // 활성 블록 — null이면 보드에 떨어지는 블록 없음 (풀 채우는 중)
    // active = 지금 떨어지고 있는 블록 1개 (없으면 null)
const [active, setActive] = useState(null);
  // 대기열: 풀 임계 도달 시 여러 블록이 한 번에 발생 가능 → FIFO로 순차 스폰
    // spawnQueue = 아직 안 나온 지출 블록 대기줄
const [spawnQueue, setSpawnQueue] = useState([]);
  const [saveQueue, setSaveQueue] = useState([]);

  const landingHeroGrid = useMemo(() => makeLandingHeroGrid(), []);
  const emptyPreviewGrid = useMemo(() => makeEmptyHomePreviewGrid(), []);
  const LANDING_PREVIEW_POOL = 57_000;
  const landingBackdrop = showLanding && !landingClosing;

  const appShellRef = useRef(null);
  const [emptyGhostSeen, setEmptyGhostSeen] = useState(loadEmptyGhostSeen);
  const [emptyGhostFading, setEmptyGhostFading] = useState(false);
  const emptyGhostDismissLock = useRef(false);

  const [goalBouncing, setGoalBouncing] = useState(false);

  const [rescueAvailable, setRescueAvailable] = useState(1);
  const [ghostMode, setGhostMode] = useState(BOOT.derived.ghostMode);
  const [pulse, setPulse] = useState(false);
  const [floatToast, setFloatToast] = useState(null); // 실체화 토스트
  const [poolHint, setPoolHint] = useState(null); // 공중 부양 안내 (최초 1회, pool-hint.jsx)
  const [monoFlash, setMonoFlash] = useState(null);    // 낱알 착지 반짝
  const [hardenRows, setHardenRows] = useState([]);    // 방금 굳은 줄 (흔들림 연출)
  const [hardenToast, setHardenToast] = useState(null); // 굳음 안내 토스트

  // 입력 바텀시트 + 즐겨찾기
  const [sheetType, setSheetType] = useState(null); // null | "spend" | "income" | "save"
  const [favorites, setFavorites] = useState(BOOT.favorites);

  // 거래 내역 — ★ 수입·지출·저축·보드·풀의 단일 진실 원천
    // ★ transactions = 모든 가계부 기록 (가장 중요한 데이터)
const [transactions, setTransactions] = useState(BOOT.transactions);

  const txTotals = useMemo(() => sumTxTotals(transactions), [transactions]);
  const displayIncome = txTotals.income;
  const expense = txTotals.expense;
  const savingsBucket = txTotals.savings;

  /** ★ 수입 단일 기준 = 수입 거래 합계 (상단 칩 · 내 정보 · 보드 · 임계값 공통) */
  const gaugeIncome = displayIncome;
  const thresholdIncome = displayIncome > 0 ? displayIncome : DEFAULT_INCOME;
  const TIER_THRESHOLD = useMemo(() => getThresholds(thresholdIncome), [thresholdIncome]);

  const goalRow = useMemo(() => computeGoalRow(), []);

  const prevGoalRowRef = useRef(goalRow);
  useEffect(() => {
    if (prevGoalRowRef.current !== goalRow) {
      setGoalBouncing(true);
      const t = window.setTimeout(() => setGoalBouncing(false), 600);
      prevGoalRowRef.current = goalRow;
      return () => window.clearTimeout(t);
    }
  }, [goalRow]);

  const targetSpend = useMemo(() => getTargetSpend(thresholdIncome), [thresholdIncome]);
  const overBudget = expense >= targetSpend;

  // 거래 리스트 시트 + 편집 모드
  const [listSheetOpen, setListSheetOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null); // 편집 중인 트랜잭션 객체

  const emptyGhostNextThreshold = useMemo(() => {
    const th = getThresholds(thresholdIncome);
    return { tier: "cyan", value: th.cyan };
  }, [thresholdIncome]);

  /** 빈 홈 1회 데모 — forceEmptyPreview 시 거래 있어도 재생 (내 정보 → 다시 보기) */
  const showEmptyPreview =
    !showLanding &&
    !landingClosing &&
    screen === "home" &&
    (forceEmptyPreview || (transactions.length === 0 && !emptyGhostSeen));

  const dismissEmptyPreview = useCallback(() => {
    if (emptyGhostDismissLock.current || showLanding) return;
    if (!forceEmptyPreview && emptyGhostSeen) return;
    emptyGhostDismissLock.current = true;
    setEmptyGhostFading(true);
    window.setTimeout(() => {
      setEmptyGhostSeen(true);
      setEmptyGhostFading(false);
      setForceEmptyPreview(false);
      emptyGhostDismissLock.current = false;
      try { localStorage.setItem(EMPTY_GHOST_KEY, "1"); } catch (_) {}
    }, EMPTY_GHOST_FADE_MS);
  }, [emptyGhostSeen, showLanding, forceEmptyPreview]);

  const onChipTap = useCallback((t) => {
    dismissEmptyPreview();
    setSheetType(t);
  }, [dismissEmptyPreview]);

  useEffect(() => {
    if (!showEmptyPreview || showLanding || landingClosing) return;
    const root = appShellRef.current;
    if (!root) return;
    let armed = false;
    let cancelled = false;
    const armTimer = window.setTimeout(() => {
      if (!cancelled) armed = true;
    }, EMPTY_GHOST_ARM_MS);
    const onFirstPointer = (e) => {
      if (!armed || showLanding || landingClosing) return;
      if (e.target.closest(".landing-start, .landing-start-slot")) return;
      if (e.button !== undefined && e.button !== 0) return;
      dismissEmptyPreview();
    };
    root.addEventListener("pointerdown", onFirstPointer, { capture: false });
    return () => {
      cancelled = true;
      window.clearTimeout(armTimer);
      root.removeEventListener("pointerdown", onFirstPointer, { capture: false });
    };
  }, [showEmptyPreview, dismissEmptyPreview, showLanding, landingClosing]);

  const previewBackdrop = landingBackdrop || showEmptyPreview;
  const previewGrid = showEmptyPreview ? emptyPreviewGrid : landingHeroGrid;

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

  // 거래 목록 기준 보드·풀 전체 재계산 — ★ 유일한 보드 갱신 경로
  
  /* 【정답으로 덮기】 derive 결과로 grid·pool 전부 교체. 편집/삭제/수입 시 */
const applyDerivedState = useCallback((derived) => {
    setGrid(derived.grid);
    setPool(derived.pool);
    setGhostMode(derived.ghostMode);
    setActive(null);
    setSpawnQueue([]);
    setSaveQueue([]);
  }, []);

  
  /* 【전체 재계산】 거래 바뀌면 deriveGameState 다시 돌림 */
const recomputeFromTransactions = useCallback((txs) => {
    applyDerivedState(deriveGameState(txs));
  }, [applyDerivedState]);

  /** 블록 DROP 세션 중에는 derive로 보드를 덮어쓰지 않음 */
    // DROP 애니 중이면 true — 세션 끝에 derive와 맞춤
const blockDropSession = useRef(false);

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

  const makeSaveBlock = (amount, label) => ({
    shape: "O",
    kind: "save",
    tier: "save",
    amount,
    label: label || "저축",
    pos: { r: 0, c: 0 },
    rot: 0,
    auto: true,
  });

  
  /* 【낱알 즉시 박기】 DROP 없이 1칸씩 바로 grid에 추가 → "막 쌓임" 체감 */
const dropMono = (amount, label, cellsNeeded) => {
    if (!cellsNeeded || cellsNeeded <= 0) return;
    const perCell = Math.max(1, Math.round(amount / cellsNeeded));
    setGrid((g) => {
      let ng = g;
      let lastFlash = null;
      let remaining = cellsNeeded;
      while (remaining > 0) {
        const before = countOccupiedCells(ng);
        const cell = pickFillCell(ng);
        if (!cell) break;
        const [r, c] = cell;
        const subtype = monoSubtype(perCell);
        const next = ng.map((row) => row.slice());
        next[r][c] = { kind: "spend", tier: "blue", mono: true, subtype, amount: perCell };
        ng = applyHarden(next);
        const added = countOccupiedCells(ng) - before;
        if (added <= 0) break;
        remaining -= added;
        lastFlash = { r, c, subtype, t: Date.now() };
      }
      if (lastFlash) setMonoFlash(lastFlash);
      return ng;
    });
    flashPulse();
  };

  const queueSaveBlocks = (amount, label, need) => {
    if (need <= 0) return;
    const n = Math.max(1, Math.ceil(need / AVG_CELLS_PER_BLOCK));
    const perAmt = Math.max(1, Math.round(amount / n));
    const blocks = Array.from({ length: n }, () => makeSaveBlock(perAmt, label));
    blockDropSession.current = true;
    if (!active && spawnQueue.length === 0 && saveQueue.length === 0) {
      const [head, ...rest] = blocks;
      setActive({ ...head, pos: { r: 0, c: pickSmartCol(grid, "O", 0) } });
      if (rest.length) setSaveQueue(rest);
    } else {
      setSaveQueue((q) => [...q, ...blocks]);
    }
    flashPulse();
  };

  
  /* 【지출 후 블록 예약】 simulateSpendStep 계획 → 큐에 넣거나 낱알 */
const queueSpendBlocks = (amount, label, need, poolBefore) => {
    const plan = simulateSpendStep(
      grid,
      poolBefore,
      amount,
      label,
      TIER_THRESHOLD,
      `live-${Date.now()}`,
      need,
      { mutateGrid: false }
    );
    const mkBlock = (b) => makeBlock(b.tier, b.amount, b.label);

    if (plan.liveBlocks.length > 0) {
      blockDropSession.current = true;
      const [head, ...rest] = plan.liveBlocks;
      const headBlk = mkBlock(head);
      if (!active && spawnQueue.length === 0 && saveQueue.length === 0) {
        setActive({ ...headBlk, pos: { r: 0, c: pickSmartCol(grid, headBlk.shape, 0) } });
        if (rest.length) setSpawnQueue(rest.map(mkBlock));
      } else {
        setSpawnQueue((q) => [...q, ...plan.liveBlocks.map(mkBlock)]);
      }
      showToast(head.tier, head.label);
    }

    if (plan.monoPlacements > 0) {
      dropMono(amount, label, plan.monoPlacements);
      if (plan.liveBlocks.length === 0) blockDropSession.current = false;
    }

    if (plan.poolOnly) {
      const hint = window.POOL_HINT?.tryPoolHintTrigger(plan.pool, TIER_THRESHOLD);
      if (hint) setPoolHint(hint);
    }
  };

  /** 내 정보 슬라이더 → 수입 거래 1건으로 동기화 (상단 수입과 항상 동일) */
  const syncIncomeToAmount = useCallback((target) => {
    const amount = Math.max(0, target);
    const prev = transactions.find((t) => t.type === "income");
    const rest = transactions.filter((t) => t.type !== "income");
    const nextTxs = amount === 0
      ? rest
      : [
          ...rest,
          {
            id: prev?.id ?? `t_income_${Date.now()}`,
            date: prev?.date ?? new Date().toISOString().slice(0, 10),
            type: "income",
            amount,
            categoryTop: "수입",
            categorySub: prev?.categorySub ?? "급여",
            createdAt: prev?.createdAt ?? 0,
          },
        ];
    setTransactions(nextTxs);
    recomputeFromTransactions(nextTxs);
    setGoalBouncing(true);
    window.setTimeout(() => setGoalBouncing(false), 600);
  }, [transactions, recomputeFromTransactions]);

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

  // 바텀시트 제출 처리
  
  /* 【★ 입력 확인 버튼 ★】 수입/지출/저축 시트에서 확정할 때 */
const handleSheetSubmit = ({ type, amount, categoryTop, categorySub, fromFavorite, saveAsFav, date }) => {
    const catLabel = categorySub || "기타";
    const txDate = date || new Date().toISOString().slice(0, 10);

    // 편집 모드 — 거래 갱신 후 보드·풀 전체 재시뮬레이션
    if (editingTx) {
      const nextTxs = transactions.map((t) =>
        t.id === editingTx.id
          ? { ...t, amount, categoryTop, categorySub: catLabel, date: txDate }
          : t
      );
      setTransactions(nextTxs);
      recomputeFromTransactions(nextTxs);
      setEditingTx(null);
      setSheetType(null);
      return;
    }

    // 신규 거래 — 거래 추가 + deriveGameState 한 경로만 (실시간 스폰 제거)
    const newTx = {
      id: `t_${Date.now()}`,
      date: txDate,
      type,
      amount,
      categoryTop,
      categorySub: catLabel,
      createdAt: Date.now(),
    };
    const nextTxs = [...transactions, newTx];
    setTransactions(nextTxs);

    if (type === "income") {
      recomputeFromTransactions(nextTxs);
      setGoalBouncing(true);
      window.setTimeout(() => setGoalBouncing(false), 600);
    } else if (type === "spend") {
      const prevDerived = deriveGameState(transactions);
      const nextDerived = deriveGameState(nextTxs);
      const need = cellDeltaFromTxChange(transactions, nextTxs);
      setPool(nextDerived.pool);
      queueSpendBlocks(amount, catLabel, need, prevDerived.pool);
    } else if (type === "save") {
      const need = cellDeltaFromTxChange(transactions, nextTxs);
      const nextDerived = deriveGameState(nextTxs);
      setPool(nextDerived.pool);
      queueSaveBlocks(amount, catLabel, need);
    }

    // 즐겨찾기 사용횟수 +1 또는 신규 즐겨찾기 등록
    if (fromFavorite) {
      setFavorites((fs) => fs.map((f) =>
        f.id === fromFavorite ? { ...f, usageCount: f.usageCount + 1 } : f
      ));
    } else if (saveAsFav && categorySub && categorySub !== "기타") {
      setFavorites((fs) => {
        const i = fs.findIndex(
          (f) => f.type === type && f.categorySub === categorySub && f.label === catLabel
        );
        if (i >= 0) {
          return fs.map((f, idx) => idx === i
            ? { ...f, amount, categoryTop, usageCount: f.usageCount + 1 }
            : f
          );
        }
        return [
          ...fs,
          {
            id: `f_${Date.now()}`,
            type, amount, categoryTop, categorySub,
            label: catLabel,
            usageCount: 1,
          },
        ];
      });
    }
    setSheetType(null);
  };

  // 거래 삭제 (편집 시트의 🗑️ 버튼) — 보드·풀 전체 재시뮬레이션
  const handleDeleteTransaction = (id) => {
    const nextTxs = transactions.filter((t) => t.id !== id);
    setTransactions(nextTxs);
    recomputeFromTransactions(nextTxs);
    setEditingTx(null);
    setSheetType(null);
  };

  // 거래 리스트에서 항목 탭 → 편집 모드 진입
  const openEditTransaction = (tx) => {
    setEditingTx(tx);
    setSheetType(tx.type);
    setListSheetOpen(false);
  };

  const handleUpdateFavorite = ({ id, label, amount, categoryTop, categorySub }) => {
    setFavorites((fs) => fs.map((f) =>
      f.id === id
        ? {
            ...f,
            label,
            amount,
            ...(categoryTop ? { categoryTop } : {}),
            ...(categorySub ? { categorySub } : {}),
          }
        : f
    ));
  };

  const handleDeleteFavorite = (id) => {
    setFavorites((fs) => fs.filter((f) => f.id !== id));
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

  
  /* 【DROP 착지】 떨어지던 블록을 grid에 고정 */
const lockActive = useCallback(() => {
    if (!active) return;
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
    const newGrid = grid.map((row) => row.slice());
    landed.forEach(([r, c]) => {
      if (r >= 0 && r < ROWS) {
        newGrid[r][c] = isSave
          ? { kind: "save", tier: "save", amount: active.amount }
          : { kind: "spend", tier: active.tier, amount: active.amount };
      }
    });
    if (!isSave && gridSpendPastGoalRow(newGrid, goalRow)) {
      setGhostMode(true);
    }
    setGrid(isSave ? newGrid : applyHarden(newGrid));
    window.playBlockLandSfx?.();
    setActive(null);
  }, [active, grid, goalRow]);

  const onRotate = () => {
    if (tryMove(0, 0, 1)) {
      window.playBlockRotateSfx?.();
      flashPulse();
    }
  };
  const onMoveLeft = () => { if (tryMove(0, -1, 0)) flashPulse(); };
  const onMoveRight = () => { if (tryMove(0, 1, 0)) flashPulse(); };
  const onSoftDrop = () => {
    if (tryMove(1, 0, 0)) flashPulse();
    else lockActive();
  };

  const onDrop = () => lockActive();

  const flashPulse = () => {
    setPulse(true);
    setTimeout(() => setPulse(false), 120);
  };

  
  /* 【저축 보상】 노란 줄만 가득 찬 행 1개 삭제 (1회) */
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

  const gridRef = useRef(grid);
  gridRef.current = grid;

  // ── AUTO SPAWN: 지출 큐 → 저축 큐 순서로 활성화 (한 번에 하나씩)
  
  /* 【큐 → 활성】 대기 중인 다음 블록을 active로 꺼냄 */
  useEffect(() => {
    if (active) return;
    if (spawnQueue.lengthuseEffect(() => {
    if (active) return;
    if (spawnQueue.length > 0) {
      const [head, ...rest] = spawnQueue;
      const smartC = pickSmartCol(gridRef.current, head.shape, head.rot || 0);
      setSpawnQueue(rest);
      setActive({ ...head, pos: { ...head.pos, c: smartC } });
      return;
    }
    if (saveQueue.length > 0) {
      const [head, ...rest] = saveQueue;
      const col = pickSmartCol(gridRef.current, head.shape, head.rot || 0);
      setSaveQueue(rest);
      setActive({ ...head, pos: { r: 0, c: col } });
    }
  }, [active, spawnQueue, saveQueue]);

  
  /* 【세션 끝 동기화】 큐 비면 derive 그리드로 맞춤 (안 맞으면 화면·숫자 어긋남) */
  // DROP 세션 종료 후 derive// DROP 세션 종료 후 derive와 보드·풀·기절 동기화 (라이브 DROP 완료 시 1회)
  useEffect(() => {
    if (active || spawnQueue.length || saveQueue.length) return;
    if (!blockDropSession.current) return;
    blockDropSession.current = false;
    const derived = deriveGameState(transactions);
    setGrid(derived.grid);
    setPool(derived.pool);
    setGhostMode(derived.ghostMode);
  }, [active, spawnQueue, saveQueue, transactions]);

  
  /* 【자동 낙하】 active 블록을 주기적으로 아래로 (바닥 닿아도 자동 착지는 안 함) */
  // ── AUTO FALL// ── AUTO FALL: 지출·저축 블록 자동 낙하 (좌우·회전은 저축만) ──
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
        // ★ 바닥·장애물에 닿아도 자동 착지하지 않음 — DROP으로만 고정 (블록 하나씩)
        return;
      } else {
        setActive((a) => a ? { ...a, pos: { r: a.pos.r + 1, c: a.pos.c } } : a);
      }
    }, AUTO_FALL_MS);
    return () => clearInterval(id);
  }, [active, grid, lockActive]);

  // ── KEYBOARD: 지출=회전·DROP / 저축=←→·회전·↓·DROP ─────────
  useEffect(() => {
    const h = (e) => {
      if (!active) return;
      if (e.key === "ArrowUp") { e.preventDefault(); onRotate(); }
      if (e.key === " ") { e.preventDefault(); onDrop(); }
      if (active.kind === "save") {
        if (e.key === "ArrowLeft")  { e.preventDefault(); onMoveLeft(); }
        if (e.key === "ArrowRight") { e.preventDefault(); onMoveRight(); }
        if (e.key === "ArrowDown")  { e.preventDefault(); onSoftDrop(); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const topExpenses = useMemo(() => {
    const th = getThresholds(thresholdIncome);
    const tierFor = (amt) => {
      if (amt >= th.orange) return "red";
      if (amt >= th.green) return "orange";
      if (amt >= th.cyan) return "green";
      return "cyan";
    };
    return [...transactions]
      .filter((t) => t.type === "spend")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((t) => ({
        cat: t.categorySub || "지출",
        amount: t.amount,
        tier: tierFor(t.amount),
      }));
  }, [transactions, thresholdIncome]);

    // 라이브 보드가 목표선 위로 넘었는지
const stackPastLine = useMemo(
    () => gridSpendPastGoalRow(grid, goalRow),
    [grid, goalRow]
  );
  const effectiveGhost = ghostMode || overBudget || stackPastLine || tweaks.ghostPreview;
  /** 목표선 돌파 시 고정된 지출 전체 기절 — 낙하 중 블록은 Board에서 별도 처리 */
    // 보드에 그릴 때 기절(흰 병아리) 켤지
const boardGhostMode = !(showEmptyPreview || landingBackdrop)
    && (stackPastLine || tweaks.ghostPreview);

  const EGG_GOAL = 18;
  // ★ 저축 = 사용자가 의식적으로 적립한 금액(savingsBucket)만.
  // 지출을 입력해도 저축 수치는 동요하지 않는다. "쓰고 남은 잔여"는 저축이 아니다.
  const effectiveSaving = savingsBucket;
  // 여유금(잔여): 수입−지출−저축 — 우측 패널 잔액 표시
  const freeCash = Math.max(0, displayIncome - expense - savingsBucket);
  const overSpend = Math.max(0, expense + savingsBucket - displayIncome);
  const savePct  = gaugeIncome > 0
    ? Math.max(0, Math.min(100, Math.round(effectiveSaving / gaugeIncome * 100)))
    : 0;
  const angerPct = gaugeIncome > 0
    ? Math.max(0, Math.min(100, Math.round(expense / gaugeIncome * 100)))
    : 0;
  const derivedEggs = gaugeIncome > 0
    ? Math.max(0, Math.min(EGG_GOAL, Math.round((effectiveSaving / gaugeIncome) * EGG_GOAL)))
    : 0;

  const [badgeViewYear, setBadgeViewYear] = useState(() => new Date().getFullYear());
  const badgeYears = useMemo(() => collectBadgeYears(transactions), [transactions]);
  const poolBadges = useMemo(
    () => deriveYearPoolBadges(transactions, badgeViewYear),
    [transactions, badgeViewYear]
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      collectBadgeYears(transactions).forEach((y) => {
        savePoolTrophyYear(y, deriveYearPoolBadges(transactions, y));
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [transactions]);

  // 거래·수입·저축률·즐겨찾기 — 새로고침 후에도 유지 (보드·풀은 거래에서 재계산)
  useEffect(() => {
    const id = setTimeout(() => {
      saveChickPersistState({ transactions, income: displayIncome, savingsGoalPct, favorites });
    }, 400);
    return () => clearTimeout(id);
  }, [transactions, displayIncome, savingsGoalPct, favorites]);

  const exportJsonBackup = useCallback(() => {
    const payload = buildChickBackup({
      transactions,
      income: displayIncome,
      savingsGoalPct,
      theme,
      favorites,
    });
    downloadTextFile(
      backupFilename("json"),
      JSON.stringify(payload, null, 2),
      "application/json;charset=utf-8"
    );
  }, [transactions, displayIncome, savingsGoalPct, theme, favorites]);

  const exportCsv = useCallback(() => {
    downloadTextFile(
      backupFilename("csv"),
      transactionsToCSV(transactions),
      "text/csv;charset=utf-8"
    );
  }, [transactions]);

  const importJsonBackup = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseChickBackup(JSON.parse(String(reader.result)));
        if (!window.confirm("지금 데이터를 백업 파일 내용으로 바꿀까요?")) return;
        const mergedTxs = (() => {
          const txs = parsed.transactions || [];
          const inc = typeof parsed.income === "number" ? parsed.income : sumIncomeTxs(txs);
          if (inc <= 0) return txs;
          const rest = txs.filter((t) => t.type !== "income");
          const prev = txs.find((t) => t.type === "income");
          return [
            ...rest,
            {
              id: prev?.id ?? `t_income_${Date.now()}`,
              date: prev?.date ?? new Date().toISOString().slice(0, 10),
              type: "income",
              amount: inc,
              categoryTop: "수입",
              categorySub: prev?.categorySub ?? "급여",
              createdAt: prev?.createdAt ?? 0,
            },
          ];
        })();
        setTransactions(mergedTxs);
        setSavingsGoalPct(parsed.savingsGoalPct);
        setFavorites(sanitizeFavorites(parsed.favorites.length ? parsed.favorites : INITIAL_FAVORITES));
        setTheme(parsed.theme);
        recomputeFromTransactions(mergedTxs);
        window.alert("복원했어요. 거래·수입·저축률·즐겨찾기·테마를 불러왔습니다.");
      } catch (err) {
        window.alert(err && err.message ? err.message : "복원에 실패했어요.");
      }
    };
    reader.onerror = () => window.alert("파일을 읽지 못했어요.");
    reader.readAsText(file, "utf-8");
  }, [recomputeFromTransactions, setTheme]);

  const appShell = (
          <div
            ref={appShellRef}
            className={`app-shell app-shell-fit${showLanding ? " app-shell--landing" : ""}`}
          >
            {!nativeDevice && <div className="status-spacer" />}
            <window.AppHeader
              income={displayIncome}
              gaugeIncome={gaugeIncome}
              expense={expense}
              saving={effectiveSaving}
              ghostMode={effectiveGhost}
              onChipTap={onChipTap}
            />

            {screen === "home" && (
            <div className={`game-zone${showLanding ? " game-zone--landing-preview" : ""}`}>
              <window.EggCartonPanel
                eggs={derivedEggs}
                goal={EGG_GOAL}
                savePct={savePct}
                theme={theme}
                onToggleTheme={toggleTheme}
                poolBadges={poolBadges}
                badgeViewYear={badgeViewYear}
                badgeYears={badgeYears}
                onBadgeViewYearChange={setBadgeViewYear}
              />

              <div className={`board-wrap${showEmptyPreview ? " board-wrap--empty-preview" : ""}${emptyGhostFading ? " board-wrap--empty-fading" : ""}`}>
                <div className="board-stack">
                  <window.PoolZone
                    pool={previewBackdrop ? LANDING_PREVIEW_POOL : pool}
                    nextThreshold={showEmptyPreview ? emptyGhostNextThreshold : nextThreshold}
                    toast={previewBackdrop ? null : floatToast}
                  />
                  <window.Board
                    grid={previewBackdrop ? previewGrid : grid}
                    active={active}
                    activeCells={activeCells}
                    ghostCells={ghostCells}
                    ghostMode={boardGhostMode}
                    pulse={pulse}
                    goalRow={goalRow}
                    goalBouncing={goalBouncing}
                    monoFlash={monoFlash}
                    hardenRows={hardenRows}
                    hardenToast={hardenToast}
                  />
                  {!previewBackdrop && poolHint && (
                    <window.POOL_HINT.PoolDepositHint
                      hint={poolHint}
                      onDone={() => setPoolHint(null)}
                    />
                  )}
                </div>
              </div>

              <window.AngerRoomPanel
                angerPct={angerPct}
                topExpenses={topExpenses}
                onOpenList={() => setListSheetOpen(true)}
                balance={freeCash}
                overSpend={overSpend}
              />
            </div>
            )}

            {screen === "stats" && (
              <window.StatsScreen
                transactions={transactions}
                income={displayIncome}
                expense={expense}
                poolBadges={poolBadges}
                badgeViewYear={badgeViewYear}
                badgeYears={badgeYears}
                onBadgeViewYearChange={setBadgeViewYear}
              />
            )}

            {screen === "me" && (
              <window.ProfileScreen
                income={displayIncome}
                onIncomeChange={syncIncomeToAmount}
                savingsGoalPct={savingsGoalPct}
                onSavingsGoalChange={setSavingsGoalPct}
                totalEggs={derivedEggs}
                theme={theme}
                onToggleTheme={toggleTheme}
                onSetTheme={setTheme}
                onReplayLanding={replayLanding}
                onReplayEmptyPreview={replayEmptyPreview}
                onExportJsonBackup={exportJsonBackup}
                onImportJsonBackup={importJsonBackup}
                onExportCsv={exportCsv}
                transactionCount={transactions.length}
              />
            )}

            {screen === "home" && !showLanding && (
            <window.Controls
              active={active}
              pool={pool}
              nextThreshold={nextThreshold}
              onRotate={onRotate}
              onMoveLeft={onMoveLeft}
              onMoveRight={onMoveRight}
              onDrop={onDrop}
              onRescue={onRescue}
              rescueAvailable={rescueAvailable}
            />
            )}

            {!(showLanding && nativeDevice) && (
            <window.BottomNav
              ghostMode={effectiveGhost}
              screen={screen}
              onSelect={setScreen}
            />
            )}

            {showLanding && (
              <window.Landing
                key={landingSession}
                onStart={startApp}
                closing={landingClosing}
              />
            )}

            {sheetType && (
              <window.BottomSheet
                type={sheetType}
                favorites={favorites}
                transactions={transactions}
                onClose={() => { setSheetType(null); setEditingTx(null); }}
                onSubmit={handleSheetSubmit}
                onUpdateFavorite={handleUpdateFavorite}
                onDeleteFavorite={handleDeleteFavorite}
                editing={editingTx}
                onDelete={handleDeleteTransaction}
              />
            )}

            {listSheetOpen && (
              <window.TransactionListSheet
                transactions={transactions}
                onClose={() => setListSheetOpen(false)}
                onEdit={openEditTransaction}
                onDelete={handleDeleteTransaction}
              />
            )}
          </div>
  );

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div className={`page-bg${nativeDevice ? " page-bg--device" : ""}`}>
      <div className={`phone-cradle${nativeDevice ? " phone-cradle--device" : ""}`}>
        {nativeDevice ? appShell : (
          <window.IOSDevice dark={true} width={402} height={874}>
            {appShell}
          </window.IOSDevice>
        )}

        {!nativeDevice && (
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
        )}
      </div>

      {!nativeDevice && (
      <window.TweaksPanel title="병아리 블록 Tweaks">
        <window.TweakSection label="미리보기">
          <window.TweakToggle
            label="👻 기절 모드 (목표선 초과)"
            value={tweaks.ghostPreview}
            onChange={(v) => setTweak("ghostPreview", v)}
          />
        </window.TweakSection>
      </window.TweaksPanel>
      )}
    </div>
  );
}


/* 【앱 시작】 id="root" div 안에 App 그리기 */
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
