# 핵심 함수 줄단위 해설 (초등학생도 이해하는 한국어 주석)

> 원본: `game-data.jsx`, `app.jsx`  
> 이 문서만 저장해서 공부해도 됩니다.

---

## 1. `sumTxTotals` — 합계 구하기

```javascript
function sumTxTotals(transactions) {
  // 세 개 상자를 0으로 시작
  let income = 0;   // 수입 합계
  let expense = 0;  // 지출 합계
  let savings = 0;  // 저축 합계

  // 거래 하나하나를 돌면서
  for (const tx of transactions) {
    if (tx.type === "income") income += tx.amount;      // 수입이면 income 상자에 더함
    else if (tx.type === "spend") expense += tx.amount; // 지출이면 expense 상자에
    else if (tx.type === "save") savings += tx.amount;  // 저축이면 savings 상자에
  }

  // 세 상자를 한 번에 돌려줌
  return { income, expense, savings };
}
```

---

## 2. `targetBoardCells` — 보드에 몇 칸 채울지

```javascript
function targetBoardCells(income, expense, savings) {
  // 수입이 0이면 기본값 320만 쓰기 (나누기 0 방지)
  const inc = income > 0 ? income : DEFAULT_INCOME;

  // (지출+저축) ÷ 수입 = 0.0 ~ 1.0 사이 비율 (100% 넘으면 1.0으로 자름)
  const ratio = Math.min(1, Math.max(0, (expense + savings) / inc));

  // 비율 × 전체 칸(128) = 목표 칸 수 (반올림)
  // 예: 수입 100만, 지출+저축 50만 → 0.5 × 128 = 64칸
  return Math.round(ratio * BOARD_CELL_COUNT);
}
```

---

## 3. `applyPoolDeposit` — 풀에 돈 넣고 블록 나올지 판단

```javascript
function applyPoolDeposit(pool, amount, thresholds) {
  // 지금 풀 + 이번 지출 = 새 합계
  const cur = pool + amount;

  // 합계가 cyan/green/orange 중 어디를 넘었는지 (가장 큰 것 하나만)
  const tier = highestPoolTier(cur, thresholds);

  // 아직 임계 안 넘음 → 블록 없음, 돈만 풀에 쌓임
  if (!tier) return { pool: cur, tier: null, thresholdValue: 0 };

  // 임계 넘음 → 블록 1개 만들고, 풀에서는 그 임계 금액만큼 빼기
  const thresholdValue = thresholds[tier];
  return { pool: cur - thresholdValue, tier, thresholdValue };
}
```

---

## 4. `simulateSpendStep` — 지출 1건 처리 (★중요★)

```javascript
function simulateSpendStep(grid, pool, amount, label, thresholds, seedBase, cellsNeeded, opts = {}) {
  // mutateGrid가 false면 그리드는 안 바꾸고 "계획"만 (app.jsx 애니메이션용)
  const mutateGrid = opts.mutateGrid !== false;

  let g = grid;                    // 작업용 보드 복사
  let p = pool + amount;           // ★ 규칙: 지출은 무조건 풀에 먼저 더함
  let remaining = Math.max(0, cellsNeeded); // 아직 채워야 할 칸 수
  let spawnedBlock = false;        // 블록이 나왔는지
  let spawnedMono = false;         // 낱알이 나왔는지
  const liveBlocks = [];             // 앱에 넘길 "떨어뜨릴 블록" 목록
  let monoPlacements = 0;          // 낱알 몇 칸 넣을지
  const monoPerCell = cellsNeeded > 0
    ? Math.max(1, Math.round(amount / cellsNeeded))  // 칸당 금액
    : Math.max(1, amount);

  // ── 경우 1: 아주 큰 지출 (orange 임계 이상) ──
  if (amount >= thresholds.orange && remaining > 0) {
    const n = Math.max(1, Math.ceil(remaining / AVG_CELLS_PER_BLOCK)); // 블록 개수
    const perAmt = Math.max(1, Math.round(amount / n));
    for (let i = 0; i < n && remaining > 0; i++) {
      if (mutateGrid) {
        // derive 경로: 그리드에 red 블록 바로 박음
        g = lockBlockOnGrid(g, "red", perAmt, label, `${seedBase}-red-${i}`);
        remaining -= (추가된 칸 수);
      } else {
        // app 경로: 나중에 떨어뜨리라고 liveBlocks에만 넣음
        liveBlocks.push({ tier: "red", amount: perAmt, label });
        remaining -= AVG_CELLS_PER_BLOCK; // 블록 1개 ≈ 4칸
      }
      spawnedBlock = true;
    }
    p = Math.max(0, p - amount); // 큰 지출은 풀에서 통째로 차감
  } else {
    // ── 경우 2: 일반 지출 → 풀 적립 후 임계 넘으면 블록 1개 ──
    const dep = applyPoolDeposit(pool, amount, thresholds);
    p = dep.pool; // 풀 잔액 갱신

    if (dep.tier && remaining > 0) {
      // cyan/green/orange 블록 1개 실체화
      if (mutateGrid) {
        g = lockBlockOnGrid(g, dep.tier, dep.thresholdValue, blkLabel, ...);
      } else {
        liveBlocks.push({ tier: dep.tier, amount: dep.thresholdValue, label: blkLabel });
        remaining -= AVG_CELLS_PER_BLOCK;
      }
      spawnedBlock = true;
    }
  }

  // ── 경우 3: 아직 채울 칸 남고 풀에 돈 있으면 → 낱알 1×1 ──
  while (remaining > 0 && p > 0) {
    const monoAmt = Math.max(1, Math.min(p, monoPerCell));
    if (mutateGrid) {
      g = placeMonoOnGrid(g, monoAmt);  // derive: 즉시 1칸 박음
      remaining -= 1;
    } else {
      monoPlacements += 1;              // app: 낱알 몇 번 넣을지만 세기
      remaining -= 1;
    }
    p = Math.max(0, p - monoAmt);       // 풀에서 낱알만큼 차감
    spawnedMono = true;
  }

  return {
    grid: g,
    pool: p,
    spawnedBlock,
    spawnedMono,
    poolOnly: !spawnedBlock && !spawnedMono,  // 풀에만 쌓이고 블록/낱알 없음
    liveBlocks,      // → app이 spawnQueue에 넣음
    monoPlacements,  // → app이 dropMono 호출
    monoPerCell,
  };
}
```

---

## 5. `deriveGameState` — ★★★ 정답 보드 ★★★

```javascript
function deriveGameState(transactions) {

  // ① 거래를 "언제 기록됐는지" 순서대로 줄 세우기
  const sorted = [...transactions].sort((a, b) => a.createdAt - b.createdAt);

  // ② 수입·지출·저축 합계 한 번에 구하기
  const totals = sumTxTotals(sorted);

  // ③ 보드 부피·풀 임계값에 쓸 "수입" (0이면 320만 기본)
  const volIncome = totals.income > 0 ? totals.income : DEFAULT_INCOME;
  const th = getThresholds(volIncome); // cyan/green/orange 금액

  // ④ 처음 상태: 빈 보드, 풀 0원, 지출·저축 누적 0
  let grid = makeBaseGrid();   // 16×8 전부 빈 칸
  let pool = 0;
  let expense = 0;
  let savingsBucket = 0;

  // ⑤ 거래를 하나씩 "다시 재생" (타임머신)
  for (const tx of sorted) {

  if (tx.type === "income") {
      // 수입 거래는 보드에 안 쌓음 — 합계에만 반영됨 (위 totals)
      continue; // → 다음 거래로
    }

    if (tx.type === "save") {
      savingsBucket += tx.amount;  // 저축 금액 누적

      // 이번까지 (지출+저축)/수입 → 보드에 몇 칸 있어야 하지?
      const target = targetBoardCells(volIncome, expense, savingsBucket);
      // 지금 보드보다 몇 칸 더 필요?
      const need = Math.max(0, target - countOccupiedCells(grid));

      // 노란 O 블록으로 need 만큼 채우기 (시뮬로 즉시 착지)
      grid = placeSaveVolume(grid, need, tx.amount, tx.id);
      // 혹시 부족하면 sync가 더 채움
      grid = syncGridToTarget(grid, target, "save");

    } else if (tx.type === "spend") {
      expense += tx.amount;  // 지출 금액 누적

      const target = targetBoardCells(volIncome, expense, savingsBucket);
      const need = Math.max(0, target - countOccupiedCells(grid));
      const label = tx.categorySub || "지출";

      // ★ 지출 1건 = 풀 + 블록 + 낱알 (그리드 직접 수정)
      const out = simSpend(grid, pool, tx.amount, label, th, tx.id, need);

      grid = syncGridToTarget(out.grid, target, "spend");
      pool = out.pool;  // 풀 잔액 갱신
    }
  }

  // ⑥ 다 재생 끝 — 기절(위험) 여부 계산
  const finalIncome = totals.income;
  const goalRowDyn = computeGoalRow();  // 목표선이 몇 번째 줄인지

  const ghostMode =
    isOverBudget(expense, finalIncome)           // 지출이 수입 80% 넘음?
    || gridSpendPastGoalRow(grid, goalRowDyn);   // 선 위에 지출 셀 있음?

  // ⑦ 결과 묶음 — app.jsx가 이걸 "정답"으로 씀
  return {
    grid,           // 보드 전체
    pool,           // 공중 풀 잔액
    income: finalIncome,
    expense,
    savingsBucket,
    goalRow: goalRowDyn,
    ghostMode,      // 위험/기절 플래그
  };
}
```

**한 줄 요약:** 장부(transactions)만 있으면 보드가 **항상 같은 방법으로** 다시 계산됨 → 이게 "정답".

---

## 6. `handleSheetSubmit` — 입력 확인 버튼 (app.jsx)

```javascript
const handleSheetSubmit = ({ type, amount, categoryTop, categorySub, fromFavorite, saveAsFav, date }) => {
  const catLabel = categorySub || "기타";
  const txDate = date || 오늘날짜;

  // ── A. 편집 모드 (이미 있는 거래 고치기) ──
  if (editingTx) {
    const nextTxs = transactions.map(...);  // 해당 거래만 수정
    setTransactions(nextTxs);
    recomputeFromTransactions(nextTxs);     // ★ derive로 보드 통째로 다시
    setEditingTx(null);
    setSheetType(null);
    return;
  }

  // ── B. 신규 거래 ──
  const newTx = { id, date, type, amount, categoryTop, categorySub, createdAt };
  const nextTxs = [...transactions, newTx];  // 장부에 한 줄 추가
  setTransactions(nextTxs);

  if (type === "income") {
    // 수입 → 보드 전체 다시 계산 (derive 한 경로)
    recomputeFromTransactions(nextTxs);
    setGoalBouncing(true);  // 목표선 통통 튀는 연출

  } else if (type === "spend") {
    // ★ 지출 — 여기가 문제의 싹: derive와 "다른" 경로도 탐
    const prevDerived = deriveGameState(transactions);      // 추가 전 정답
    const nextDerived = deriveGameState(nextTxs);         // 추가 후 정답
    const need = cellDeltaFromTxChange(transactions, nextTxs); // 이번에 늘 칸 수
    setPool(nextDerived.pool);                            // 풀은 정답으로 맞춤
    queueSpendBlocks(amount, catLabel, need, prevDerived.pool); // 블록/낱알은 연출로

  } else if (type === "save") {
    const need = cellDeltaFromTxChange(transactions, nextTxs);
    const nextDerived = deriveGameState(nextTxs);
    setPool(nextDerived.pool);
    queueSaveBlocks(amount, catLabel, need);  // 노란 블록 큐
  }

  // 즐겨찾기 처리 ...
  setSheetType(null);  // 입력 시트 닫기
};
```

**왜 버그가 나기 쉬운가?**

| type | 보드 갱신 방법 |
|------|----------------|
| income, 편집, 삭제 | `recomputeFromTransactions` → **derive만** |
| spend | `queueSpendBlocks` + `dropMono` → **연출이 grid 직접 수정** |

→ spend만 **두 갈래**라서 숫자(114%)와 보드(반만 참)가 어긋날 수 있음.

---

## 7. 흐름 그림 (지출 1번 넣을 때)

```
[사용자] 커피 5500원 확인
    ↓
handleSheetSubmit (spend)
    ↓
transactions에 한 줄 추가
    ↓
┌─────────────────────┬──────────────────────┐
│ deriveGameState     │ queueSpendBlocks     │
│ (정답 계산)         │ (화면 연출)          │
│ pool, grid 이상적  │ active, dropMono     │
└─────────────────────┴──────────────────────┘
    ↓ (DROP 세션 끝)
useEffect → deriveGameState로 grid 맞추기 (1회)
```

---

## 8. 공부할 때 질문 리스트

1. `deriveGameState`만 있으면 앱이 돌아갈 수 있을까? → **가능** (연출만 없어짐)
2. `queueSpendBlocks` 없이 spend만 넣으면? → `recompute`만 쓰면 **숫자·보드 일치**
3. `pool`은 어디서 진짜? → **derive가 정답**, app의 pool은 중간에 어긋날 수 있음

---

*더 보려면 `study/annotated/03-game-data.commented.jsx`, `04-app.commented.jsx`*
