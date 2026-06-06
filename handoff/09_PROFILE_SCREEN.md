# 09 — 내 정보 화면 (Profile)

> Cursor 작업 지시서. 프로토타입 구현은 `screens.jsx`의 `ProfileScreen` 참조.

---

## 1. 진입 / 위치

- bottom-nav 우측 탭 **"내 정보"** 클릭
- 전체 화면 점유 (헤더만 유지, 게임존 자리에 슬롯)

---

## 2. 구성 (★ 확정, 4섹션)

```
┌─────────────────────────────┐
│ ① 프로필 카드                │
├─────────────────────────────┤
│ ② INCOME · BLOCK SIZE        │
│   - 월 수입 슬라이더          │
│   - 블록 임계값 미리보기 (3칸)│
│   - 목표 저축률 슬라이더      │
├─────────────────────────────┤
│ ③ PREFERENCES                │
│   - 낮/밤 모드 (action-btn)   │
│   - 데이터 백업               │
│   - CSV 내보내기              │
└─────────────────────────────┘
```

> 카테고리 관리는 입력 시트의 빠른 칩 + 더보기로 충분 → 별도 섹션 만들지 않음.

---

## 3. ① 프로필 카드

### 레이아웃
```
┌──────────────────────────────┐
│ 🐤    병아리지기 🐤            │
│       since 2026.01 · 5개월째 │
│       18    12    320         │
│       알   스트릭  수입(만)   │
└──────────────────────────────┘
```

### 요소
- **아바타** (56×56, 노란 원형 테두리) — `assets/chick_save.png`
- **닉네임** — 15px / 800 / -0.02em (고정 mock: "병아리지기 🐤")
- **since** — 10px JetBrains Mono ink-3
- **3-stat row**
  - `누적 알` = `totalEggs` (App에서 derivedEggs prop)
  - `최장 스트릭` = mock 12
  - `월 수입(만)` = `round(income / 10000)`

### 스타일
- 배경: `linear-gradient(135deg, rgba(255, 232, 153, 0.18), rgba(255, 232, 153, 0.06))`
- border: `rgba(255, 232, 153, 0.35)`
- 라이트: 더 따뜻한 크림 톤으로 분기

---

## 4. ② INCOME · BLOCK SIZE (★ 핵심 섹션)

### 의도
**수입에 따라 블록 임계값이 자동 비례**한다는 메커니즘을 슬라이더 한 줄로 시연. 사용자가 자기 수입을 직접 넣어 보면서 "내 600만 vs 친구 150만은 블록 사이즈가 다르다" 를 체감하게 함.

### 4-1. 월 수입 슬라이더
```
이번 달 수입                    320만원
[━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━]
1,000,000 ─────────────── 10,000,000
step: 100,000
```

- props: `income`, `onIncomeChange(next)`
- 단위: 원, step 10만, min 100만, max 1000만
- 라벨 우측 값: `round(income / 10000)`만원

### 4-2. 블록 임계값 미리보기 (★ 라이브 갱신)
슬라이더 아래 3칸 칩 가로 배열:

```
┌────────┬────────┬────────┐
│ CYAN   │ GREEN  │ ORANGE │
│ 1.5%   │ 3%     │ 15%    │
│ 5만    │ 10만   │ 50만   │
└────────┴────────┴────────┘
```

- `getThresholds(income)` 호출해서 그대로 표시
- 슬라이더 움직이면 즉시 갱신 (flash 애니메이션 옵션, 220ms scale)
- 칩 컬러: tier stroke 색 (`#3FBBD8` / `#5BBE80` / `#F08A4D`)
- 다크/라이트에서 텍스트 컬러만 분기

#### 임계값 공식 (`game-data.jsx` `getThresholds`)
```js
const TIER_RATIO = { cyan: 0.015, green: 0.03, orange: 0.15 };
const roundMan = (n) => Math.max(10_000, Math.round(n / 10_000) * 10_000);

function getThresholds(income) {
  return {
    cyan:   roundMan(income * 0.015),
    green:  roundMan(income * 0.03),
    orange: roundMan(income * 0.15),
  };
}
```

| 수입 | cyan | green | orange | red short-circuit |
|------|------|-------|--------|-------------------|
| 150만 | 2만 | 5만 | 23만 | ≥ orange |
| 320만 | 5만 | 10만 | 48만 | ≥ orange |
| 600만 | 9만 | 18만 | 90만 | ≥ orange |
| 1000만| 15만 | 30만 | 150만 | ≥ orange |

### 4-3. 골 라인 동적 조정 (★)
수입을 바꾸면 보드의 **목표 지출선 행(goalRow)** 도 비례 조정.

```js
// 기준: income 320만일 때 goalRow = 5
const setIncomeDirect = (next) => {
  setIncome(next);
  const target = clamp(2, 13, round(5 * 320만 / next));
  setGoalRow(target);
  setGoalBouncing(true);  // 600ms bounce 애니메이션
  setTimeout(() => setGoalBouncing(false), 600);
};
```

| 수입 | goalRow |
|------|---------|
| 150만 | 약 11 (지출 한도 빡빡) |
| 320만 | 5 |
| 600만 | 약 3 (너그러움) |
| 1000만 | 2 (가장 위) |

### 4-4. 목표 저축률 슬라이더
```
목표 저축률                          20%
[━━━━━━━━━●━━━━━━━━━━━━━━━━━━]
5% ──────────────────────── 50%
step: 5%

매달 수입의 20%(64만원)를 계란판에 채우는 게 목표예요.
```

- props: `savingsGoalPct`, `onSavingsGoalChange(next)`
- min 5, max 50, step 5
- 하단 hint에 실제 금액(`income * pct / 100`) 라이브 표시

---

## 5. ③ PREFERENCES

### 5-1. 낮/밤 모드 (action-btn)
- `theme === "dark"` → 제목 "밤 모드" / 부제 "현재 밤 모드 · 탭해서 낮으로 전환"
- `theme === "light"` → 제목 "낮 모드" / 부제 "현재 낮 모드 · 탭해서 밤으로 전환"
- 아이콘 자리: `chick_day.png` / `chick_night.png` (22×22)
- 우측: › chevron
- 클릭 → `toggleTheme()` 호출 (사이드패널 마스코트와 동일 함수)

> 자세한 토글 사양은 `07_THEME_TOGGLE.md` 참조.

### 5-2. 데이터 백업
- 아이콘: ☁️ (배경 `rgba(184, 230, 193, 0.18)` 파스텔 그린)
- 부제: `"마지막 동기화 · 어제 23:42"` (mock)
- 클릭 → 임시 alert. 실제 구현은 Cursor 영역.

### 5-3. CSV 내보내기
- 아이콘: ⤓ (배경 `rgba(215, 192, 255, 0.18)` 파스텔 퍼플)
- 부제: `"엑셀에서 열어보기"`
- 클릭 → 임시 alert. 실제 구현은 Cursor 영역.

### 액션 버튼 공통 (`.action-btn`)
```css
display: flex; align-items: center; gap: 10px;
padding: 11px 14px;
background: rgba(255, 255, 255, 0.05);  /* 다크 */
border: 1px solid rgba(255, 255, 255, 0.12);
border-radius: 10px;
font-size: 12.5px; font-weight: 700;
```
- 라이트: `rgba(255, 255, 255, 0.7)` + border `rgba(150, 130, 80, 0.25)`
- hover: `translateY(-1px)` + 배경 살짝 진하게

---

## 6. State 흐름 (App ↔ ProfileScreen)

### App에 추가된 state
```js
const [income, setIncome] = useState(3_200_000);
const [savingsGoalPct, setSavingsGoalPct] = useState(20);
const [theme, setThemeState] = useState(/* localStorage 복원 */);
```

### ProfileScreen props
```ts
{
  income: number;
  onIncomeChange: (next: number) => void;   // = setIncomeDirect (goalRow 함께 조정)
  savingsGoalPct: number;
  onSavingsGoalChange: (next: number) => void;
  totalEggs: number;                        // derivedEggs
  theme: "dark" | "light";
  onToggleTheme: () => void;
}
```

### 영속화 키
- `chick.theme` → `"dark" | "light"`
- (확장 시) `chick.income`, `chick.savingsGoalPct` 도 localStorage에

---

## 7. 검증 체크리스트

- [ ] 수입 슬라이더 움직이면 → 임계값 칩 3개가 즉시 갱신
- [ ] 수입 변경 시 보드의 목표 지출선 행이 비례 이동 + bounce
- [ ] 600만으로 올리면 cyan 9만, green 18만, orange 90만 표시
- [ ] 150만으로 내리면 cyan 2만, green 5만, orange 23만 표시
- [ ] 목표 저축률 라벨 hint 금액(`pct% (XX원)`)도 라이브 반영
- [ ] 낮/밤 모드 action-btn이 사이드패널 마스코트와 동기화
- [ ] 라이트 모드에서 카드/버튼/슬라이더 가독성 OK
- [ ] 프로필 카드 누적 알 숫자가 좌측 사이드패널 알 수와 일치

---

## 8. 향후 확장 후보

- 닉네임 인라인 편집
- 프로필 사진 업로드
- 시작 월 변경
- 알림 설정 (RED 임계치, 데일리 리포트 시각, 주간 회고)
- 백업 실제 구현 (Google Drive / iCloud / 이메일)
- CSV 내보내기 실제 구현 (기간 선택 + 다운로드)
- 도움말 / 약관 / 버전 정보
- 계정 / 로그아웃
