# 08 — 통계 화면 (Stats)

> Cursor 작업 지시서. 프로토타입 구현은 `screens.jsx`의 `StatsScreen` 참조.

---

## 1. 진입 / 위치

- bottom-nav 가운데 탭 **"통계"** 클릭
- 전체 화면 점유 (헤더만 유지, 게임존 자리에 슬롯)
- 뒤로가기: bottom-nav "홈" 탭

---

## 2. 구성 (★ 확정, 카드 2개만)

```
┌─────────────────────────────┐
│  ① RED 회고 카드 (헤드라인)  │
├─────────────────────────────┤
│  ② 카테고리 도넛             │
└─────────────────────────────┘
```

향후 추가 후보(이번 라운드에선 만들지 않음): 캘린더 히트맵 · 블록 발생 카운트 · 분노↔저축 트렌드.

---

## 3. ① RED 회고 카드

### 의도
"이번 달 충동·후회 지출(RED 카테고리)을 한눈에" — 앱의 핵심 메시지(`돈은 곧 병아리의 생명`)를 통계 진입 직후 첫 시야에 강하게.

### 데이터
- 필터: `transactions.filter(t => t.type === "spend" && t.categoryTop === "RED")`
- `redTotal` = 합계
- `redPct`   = `round(redTotal / income * 100, 1)` (소수 1자리)
- `topRed`   = 금액 내림차순 상위 3건

### 레이아웃
```
┌───────────────────────────────┐
│ RED · 회고 카드        🐤 (병아리)│
│ 충동·후회 지출을               │
│ 이만큼 했어요                  │
│                               │
│   42,300원 · 수입의 1.3%      │
│   5월 1일 ~ 26일 · 8건         │
├───────────────────────────────┤
│ • 커피         18,200원        │
│ • 충동구매     14,500원        │
│ • 택시          9,600원        │
├───────────────────────────────┤
│ │ "RED 라벨이 슬슬 쌓이고…"    │
└───────────────────────────────┘
```

### 병아리 일러스트 (오른쪽 위)
- `redTotal < 50_000`  → `chick_spend_nu.png` (빨간 병아리)
- `redTotal >= 50_000` → `chick_ghost_nu.png` (천사 병아리, 기절)

### 회고 메시지 (자동 생성, 4단계)
| 조건 | 메시지 |
|------|--------|
| `redTotal === 0` | "이번 달은 RED가 0원이야. 병아리가 평온하게 잠들겠는데?" |
| `< 30,000` | "충동 지출이 잘 통제됐어. 이 페이스를 유지해 보자." |
| `< 100,000` | "RED 라벨이 슬슬 쌓이고 있어. 커피·택시는 의식적으로 줄여 보자." |
| `>= 100,000` | "후회가 큰 항목이 꽤 쌓였어. 한 번 돌아보고 다음 주는 조정해 보자." |

### 스타일
- 배경: `linear-gradient(135deg, rgba(229, 76, 90, 0.18), rgba(229, 76, 90, 0.06))`
- border: `rgba(229, 76, 90, 0.35)`
- 빅 숫자: 28px JetBrains Mono 800, `--pastel-red`
- 인용구: 좌측 2px red border, italic, 11px ink-2
- 라이트 모드: 배경을 `rgba(255, 220, 220, 0.95) → rgba(255, 240, 240, 0.7)`로 더 부드럽게

---

## 4. ② 카테고리 도넛

### 의도
"이번 달 어디에 가장 많이 썼나" — RED 카드가 *후회 중심*이라면 도넛은 *전체 지출 분포 중심*.

### 데이터
```js
const byTop = {};
transactions
  .filter(t => t.type === "spend")
  .forEach(t => byTop[t.categoryTop] = (byTop[t.categoryTop] || 0) + t.amount);

const entries = Object.entries(byTop)
  .map(([cat, amt]) => ({ cat, amt, color: TOP_COLORS[cat] }))
  .sort((a, b) => b.amt - a.amt);
```

- `TOP_COLORS` 는 `game-data.jsx`에 정의된 카테고리 컬러
- 정렬: 금액 내림차순

### 레이아웃 (가로 2분할)
```
┌────────────┬─────────────────┐
│            │ ■ 생활    35%   │
│   도넛     │ ■ RED     22%   │
│  (130px)   │ ■ 고정    18%   │
│   ⬤ 총     │ ■ 주거    14%   │
│   184만   │ ■ 커플     8%   │
│            │ ■ 구독     3%   │
└────────────┴─────────────────┘
```

- 도넛 SVG: viewBox `0 0 120 120`, 반지름 50, stroke-width 16
- 트랙: `rgba(255, 255, 255, 0.06)` (다크) / `rgba(150, 130, 80, 0.12)` (라이트)
- 세그먼트: `stroke-dasharray={len} {CIRC}` + `stroke-dashoffset={-acc}` 누적
- 회전: `rotate(-90 60 60)` (12시 방향에서 시작)
- 중앙: `fmtKRW(totalExp)` (예: `184만`) + 아래 "총 지출"

### 범례
- 최대 6개까지 노출 (`slice(0, 6)`)
- 각 행: 8×8 컬러 점 + 카테고리명 + 우측 정렬 %

### 애니메이션
- 도넛 진입 시 각 세그먼트가 0에서 자기 길이까지 늘어남 (transition: `stroke-dashoffset 0.5s ease`)

---

## 5. 데이터 의존성

### 필요한 props (App → StatsScreen)
- `transactions: Transaction[]`
- `income: number`
- `expense: number`

### 필요한 game-data 상수
- `TOP_COLORS` — 카테고리 컬러 매핑 (이미 있음)

### Transaction 스키마 (`app.jsx` 시드 참조)
```ts
type Transaction = {
  id: string;
  type: "spend" | "income" | "save";
  amount: number;
  categoryTop: string;     // "RED" | "생활" | "커플" | ...
  categorySub: string;     // "커피" | "외식" | ...
  date: string;            // "2026-05-21"
  memo?: string;
};
```

---

## 6. 라이트/다크 톤 분기

- 다크: 카드 배경 `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.08)`
- 라이트: 카드 배경 `rgba(255,255,255,0.7)`, border `rgba(150,130,80,0.20)`, 1px shadow

도넛 트랙 컬러, donut-center 텍스트 컬러, dl-pct 색만 라이트에서 따로 지정.

---

## 7. 향후 확장 후보 (이번엔 안 만듦)

- **캘린더 히트맵** — 일별 지출 강도. RED만 별도 색.
- **분노↔저축 트렌드** — 30일 일별 두 게이지 라인 그래프
- **블록 발생 카운트** — `cyan ▪︎▪︎▪︎▪︎▪︎ 5  green ▪︎▪︎ 2  orange ▪︎ 1  red ✕0`
- **주간 vs 월간 토글** — 상단 segment pill
- **카테고리 도넛 → 탭하면 하위 sub 도넛으로 드릴다운**
- **RED 회고 카드의 상위 3건을 탭하면 거래 상세 시트로 점프**
