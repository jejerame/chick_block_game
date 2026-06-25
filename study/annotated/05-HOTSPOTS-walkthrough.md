# 핵심 함수 줄단위 해설 (초보용)

> `03-game-data.commented.jsx`와 `04-app.commented.jsx`를 읽다가 **이 함수만** 더 자세히 보고 싶을 때.

---

## 1. `deriveGameState` — 정답 보드 만드는 법

```
거래 목록을 시간순으로 하나씩 처리한다
```

| 단계 | 코드가 하는 일 | 쉬운 말 |
|------|----------------|---------|
| 1 | `sorted = 거래 정렬` | 먼저 일어난 일부터 |
| 2 | `sumTxTotals` | 수입·지출·저축 합계 |
| 3 | `grid = 빈 보드` | 16×8 빈 칸 |
| 4 | `pool = 0` | 공중 풀 0원 |
| 5 | 각 거래 반복 | 하나씩 재생 |
| 5a | `income` | 그리드 안 바꿈 (숫자만 씀) |
| 5b | `save` | 저축 합계 + 노란 블록 쌓기 |
| 5c | `spend` | 지출 합계 + `simSpend` (풀·블록·낱알) |
| 6 | `targetBoardCells` | (지출+저축)/수입 → 몇 칸 채울지 |
| 7 | `syncGridToTarget` | 부족하면 칸 더 채움 |
| 8 | `ghostMode` | 80% 넘음 OR 선 위에 지출 있음 |

**기억:** 앱이 망가졌을 때 "정답"은 항상 이 함수 결과.

---

## 2. `simulateSpendStep` — 지출 1건 처리 순서

```
지출 금액이 들어오면:
```

1. `pool += amount` — **무조건 풀에 먼저 넣음**
2. 금액이 orange 임계 이상? → **red 블록** (큰 결제)
3. 아니면 `applyPoolDeposit` → 임계 넘으면 **티어 블록 1개**
4. 아직 채울 칸 남고 풀에 돈 있으면 → **낱알 1칸씩**
5. `mutateGrid: false` (app에서) → 그리드는 안 바꾸고 **계획만** 돌려줌

---

## 3. `handleSheetSubmit` — 입력 버튼 누를 때 (app.jsx)

| type | 하는 일 |
|------|---------|
| **편집 중** | 거래 수정 → `recomputeFromTransactions` (보드 통째로 다시) |
| **income** | 거래 추가 → `recomputeFromTransactions` |
| **spend** | 거래 추가 → `cellDelta` 계산 → `queueSpendBlocks` (연출) |
| **save** | 거래 추가 → `queueSaveBlocks` |

**★ 문제 지점:**  
`spend`는 `recompute` 전체가 아니라 `queueSpendBlocks`만 호출 → **derive와 다른 grid**가 될 수 있음.

---

## 4. `queueSpendBlocks` + `dropMono`

- `simulateSpendStep(..., mutateGrid: false)` 로 **뭘 할지 계획**
- 블록 있으면 → `spawnQueue` / `active` (떨어지는 연출)
- 낱알 있으면 → `dropMono` (**즉시** grid에 박음, DROP 없음)

---

## 5. DROP 세션 끝 `useEffect`

```
active 없고 + 큐 비었고 + blockDropSession 이면:
  deriveGameState(transactions) 결과로 grid, pool, ghostMode 맞춤
```

세션 중에는 라이브 grid ≠ derive grid 일 수 있음.

---

## 6. 자주 헷갈리는 변수

| 이름 | 뭐냐 |
|------|------|
| `transactions` | 가계부 장부 (진짜 데이터) |
| `grid` | 화면에 보이는 보드 |
| `pool` | 공중에 떠 있는 자잘한 지출 합 |
| `active` | 지금 떨어지는 블록 1개 |
| `spawnQueue` | 다음에 나올 지출 블록 줄 |
| `ghostMode` | 기절(위험) 상태 플래그 |
| `goalRow` | 목표 지출선이 있는 줄 번호 |

---

## 7. 연습 방법

1. `npm run build` 후 브라우저에서 앱 열기  
2. F12 → Console 에서 `window.GAME.deriveGameState([])` 입력 → 빈 보드 결과 확인  
3. 지출 하나 넣은 뒤 거래 배열 넣어서 `deriveGameState(거래)` 다시 호출해 보기  

(번들에 GAME이 노출돼 있으면 콘솔에서 실험 가능)
