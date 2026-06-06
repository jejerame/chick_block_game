# 블록별 지출금액 규칙 — Cursor 핸드오프 노트

> 이 앱의 각 "블록(테트로미노)"은 단순한 도형이 아니라 **하나의 거래(지출 또는 저축)** 입니다.
> 블록마다 `kind / tier / amount / label` 4가지 속성이 붙어 있고, **티어가 금액 구간을 결정**합니다.

---

## 1. 블록 = 거래 1건

각 블록(active piece, 보드 위 락된 piece, queue의 next piece 전부)은 다음 구조를 가집니다:

```js
{
  shape: "T",            // 도형 (T/L/J/S/Z/O/I) — 시각적 모양만
  kind:  "spend",        // "spend"(지출) | "save"(저축)
  tier:  "orange",       // 금액 구간 (아래 TIER 표 참조). save면 항상 "save"
  amount: 184000,        // 실제 원화 금액
  label:  "쇼핑 — 옷"    // 사용자에게 보여주는 카테고리/설명
}
```

블록을 구성하는 **각 셀(병아리)** 도 동일한 `{ kind, tier, amount }` 를 들고 보드에 락됩니다 (`game-data.jsx` `put()` 참조). 즉 블록 = 4 셀이 같은 금액·티어·종류를 공유.

---

## 2. 티어(TIER) — 금액 구간 정의

`game-data.jsx`의 `TIER` 객체. **stroke / fill / label / hint** 4개가 한 묶음.
`amount`는 반드시 해당 티어의 `label` 구간 안에 들어와야 합니다.

| tier     | 금액 구간    | stroke (테두리) | hint (예시 카테고리)  |
| -------- | ------------ | --------------- | --------------------- |
| `blue`   | < 1만        | `#6E96FF`       | 커피·간식             |
| `cyan`   | 1만 ~ 5만    | `#3FBBD8`       | 편의점·소품           |
| `green`  | 5만 ~ 10만   | `#5BBE80`       | 외식·교통             |
| `orange` | 10만 ~ 50만  | `#F08A4D`       | 쇼핑·구독             |
| `red`    | 50만 +       | `#E54C5A`       | 큰 결제 (월세 등)     |

저축 전용:

| tier   | stroke    | 용도              |
| ------ | --------- | ----------------- |
| `save` | `#E5C04F` | 모든 저축 블록    |

> ⚠️ **암묵 규칙**: 새 블록을 만들 때 `amount`와 `tier`가 일치하지 않으면 UI가 거짓말을 하게 됩니다. 예) `tier: "blue"` 인데 `amount: 200000` 이면 보드는 파란 테두리지만 실제 금액은 20만원 — 디자인 의도에 어긋남.

---

## 3. 블록이 사는 3곳

### (a) 초기 보드 상태 — `makeInitGrid()`
이번 달에 이미 일어난 지출/저축. `piece(kind, tier, amount, cells)` 헬퍼로 셀 좌표를 직접 박아넣습니다.
- 하단 2줄: 저축 블록들 (`save / save / 80000`)
- 그 위로 지출 블록들 — 줄이 자동으로 안 지워지도록 의도적 빈칸 포함

### (b) 다음 떨어질 블록 큐 — `PIECE_QUEUE`
배열 순서대로 사용자가 마주칠 블록. 현재 5개:

```js
[
  { shape: "T", kind: "spend", tier: "green",  amount:  78000, label: "외식·점심" },
  { shape: "L", kind: "spend", tier: "orange", amount: 184000, label: "쇼핑 — 옷" },
  { shape: "S", kind: "spend", tier: "cyan",   amount:  32000, label: "택시" },
  { shape: "O", kind: "spend", tier: "blue",   amount:   9500, label: "커피" },
  { shape: "J", kind: "spend", tier: "red",    amount: 528000, label: "월세 잔금" },
]
```

### (c) 활성(떨어지는 중) 블록 — `app.jsx` 상태
큐에서 하나씩 꺼내 active로 올라옴. 셀 카드(우하단)와 NEXT 미리보기에 `amount / label / tier` 표시.

---

## 4. 금액이 영향 주는 UI

| 위치                  | 표시되는 값                                  | 출처                          |
| --------------------- | -------------------------------------------- | ----------------------------- |
| 헤더 income/expense/saving 칩 | 월간 합계 (현재는 하드코딩된 상수)    | `app.jsx` 상태                |
| 좌측 계란판           | `round(saving/income × 18)` 알               | 계산식                        |
| 우측 분노 게이지      | `round(expense/income × 100)` %              | 계산식                        |
| 우측 "지출 TOP 3"     | 큰 금액 블록 3개                             | (현재 정적)                   |
| 활성 블록 카드        | active piece의 `amount`, `label`, tier 라벨  | `PIECE_QUEUE[i]`              |
| 보드 셀 테두리 색     | tier의 `stroke`                              | `TIER[tier].stroke`           |

> 📌 **알려진 미구현**: DROP 시 `amount`를 expense에 더해서 헤더/게이지를 라이브 갱신하는 로직은 아직 없습니다. 락만 되고 숫자는 그대로. (CLAUDE.md "향후 작업 후보" 참조)

---

## 5. 블록 추가/수정 체크리스트

새 블록을 만들거나 금액을 바꿀 때:

1. **`tier`와 `amount` 구간 일치 확인** (표 §2)
2. `kind: "save"` 면 `tier: "save"` 강제
3. `label`은 한국어 짧게 — 카드와 헤더에 그대로 노출됨 (~10자 이하 권장)
4. `shape`는 `SHAPES` 객체에 정의된 키만 사용 (T/L/J/S/Z/O/I)
5. 초기 보드에 추가할 땐 `makeInitGrid()` 안에서 `piece()` 호출하고 **셀이 겹치지 않는지** 확인
6. 큐에 추가할 땐 `PIECE_QUEUE` 끝에 push (순서대로 소모됨)

---

## 6. 핵심 파일 위치

- `game-data.jsx` — TIER / SHAPES / makeInitGrid / PIECE_QUEUE **(이 문서의 모든 데이터는 여기서 옴)**
- `components.jsx` — Board 렌더, 셀에 tier stroke 적용
- `app.jsx` — active/queue 상태 관리, 헤더 수치
- `styles.css` — `.chick` / `.chick.ghost` / 셀 스타일
