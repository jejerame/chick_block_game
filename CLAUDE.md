# 병아리 블록 가계부 — 프로젝트 가이드

> 새 채팅에서 작업을 이어받을 때 반드시 먼저 이 문서를 읽고, `handoff/` 폴더와 필요한 소스 파일들을 확인한 다음 작업을 시작하세요.

## 한 줄 요약
테트리스 메커니즘을 가계부에 접목한 **모바일 인터랙티브 프로토타입**. 자잘한 지출이 공중에서 합산되다가 임계 금액 넘으면 블록으로 실체화되어 자동 낙하 → 사용자는 회전·드롭만 가능. 저축은 사용자가 의식적으로 끼워 넣음(비대칭). **"돈은 곧 병아리의 생명이다"** + **"지출은 못 막아도 저축은 의식적으로"**.

## 진입점
- 메인 파일: **`index.html`** — 모든 새 채팅에서 이 파일을 먼저 열어 동작 확인.
- iPhone 프레임(402×874) 안에 풀스크린 게임 UI.

## 📂 handoff/ 폴더 (★ Cursor 작업 지시서, 진실의 원천)
프로젝트의 핵심 결정사항은 전부 이 폴더에 마크다운으로 정리되어 있음. **새 대화 시작할 때 반드시 훑어봐야 함.**

```
handoff/
  01_MECHANIC_v2.md         # 공중 부양 풀 시스템 + 비대칭 컨트롤 + 라인 클리어 금지 + 수입→골라인 bounce
  02_SHAPES.md              # 7 도형 ↔ 4 티어 매핑 (S/Z=cyan, T/O=green, L/J=orange, I=red)
  03_INPUT_AND_FAVORITES.md # 칩탭→바텀시트 입력, 즐겨찾기 시스템, 인라인 토글
  04_CATEGORIES.md          # 9 카테고리 2-depth (RED·생활·커플…), 빠른 칩 4개 + 더보기
  05_QUICK_CHIPS_SCROLL.md  # PC 휠/드래그 가로 스크롤 + 좌·우 양방향 화살표
  06_TRANSACTION_HISTORY.md # 항목 보기/수정 시트, 편집·삭제 + 보드 recompute 주의
  07_THEME_TOGGLE.md        # 낮/밤 모드 (병아리 마스코트 토글) — 숲 테마는 폐기됨, 밤/낮 2종
  08_STATS_SCREEN.md        # 통계 화면 (RED 회고 카드 + 카테고리 도넋)
  09_PROFILE_SCREEN.md      # 내 정보 화면 (프로필 / 수입·저축률 / 테마 / 백업)
  10_LANDING.md             # 첫 실행 랜딩 페이지 (localStorage 플래그, 다시보기 방법)
```

handoff/ 파일들이 코드와 충돌하면 **handoff/가 진실**. 코드는 프로토타입이라 일부만 구현돼 있음.

## 파일 구조
```
index.html                  # 진입점 (스크립트 로드 순서)
app.jsx                     # 루트 App — 상태(transactions, pool, theme, screen, showLanding …), 핸들러
components.jsx              # Board, EggCartonPanel, AngerRoomPanel, AppHeader, Controls,
                            # BottomNav, PoolZone, BottomSheet, TransactionListSheet,
                            # ThemeMascot, Landing
screens.jsx                 # StatsScreen, ProfileScreen (통계/내정보 탭)
game-data.jsx               # 상수: TIER, SHAPES(+DOT), TIER_THRESHOLD, getThresholds, SHAPE_BY_TIER,
                            # CATEGORIES, TOP_COLORS, DEFAULT_QUICK_SUBS, INITIAL_FAVORITES,
                            # pickSmartCol, pickFillCell, hardenFullRows, monoSubtype, MONO_MAX
styles.css                  # 모든 스타일 (다크 기본 + [data-theme="light"] 라이트 오버라이드)
ios-frame.jsx               # 스타터 — iPhone 디바이스 프레임 (수정 금지)
tweaks-panel.jsx            # 스타터 — Tweaks 패널 (수정 금지)
handoff/                    # ★ Cursor 작업 지시서 6개 (위 참조)
assets/
  chick_save.png            # 노란 병아리 (저축)
  chick_spend_nu.png        # 빨간 병아리 (지출) 누끼  ★ 사용
  chick_ghost_nu.png        # 천사 병아리 (기절) 누끼  ★ 사용
  chick_spend.png / chick_ghost.png  # 원본 (fallback)
v1_*.html, v1_*.jsx, v1_*.css   # 데스크탑 초기 버전 보존본 (수정 금지)
```

스크립트 로드 순서(`index.html`): React → ios-frame → tweaks-panel → **game-data** → **components** → **screens** → **app**.
각 babel 스크립트는 `(function(){ ... })()` IIFE로 감싸 스코프 격리, 끝에 `Object.assign(window, {...})`로만 외부 노출.

> 되돌리기 안전망: `classic/` 폴더에 테마/폰트 개편 직전 전체 사본 보관. 새 UI가 아예 안 맞으면 `classic/`에서 복원.

---

## 🎮 핵심 메커니즘 — 공중 부양 합산 풀

> 자세한 사양은 `handoff/01_MECHANIC_v2.md` 참조.

1. **자잘한 지출**(< 50만)이 발생할 때마다 보드 상단 풀에 누적
   - ★ 단, **소액(< 2만, 고정)은 풀을 건너뛰고 1×1 낱알로 즉시 낙하** (아래 5항)
2. 풀이 임계 금액 넘으면 **해당 티어의 블록이 자동 실체화** + 자동 낙하
   - ★ 임계값은 **수입 비례** (`getThresholds(income)`, game-data): cyan 1.5% / green 3% / orange 15%, 만 단위 반올림
   - 단일 거래 ≥ orange 임계 → 즉시 red short-circuit
3. **낙하 중 사용자 조작**: 회전 (↑) + 즉시 드롭 (Space/DROP) **만** 가능. 좌우 이동 ❌
   - ★ 랜덤 컬럼 대신 **`pickSmartCol`** — 스폰 시점 보드에서 가장 평평해지는(구멍·요철·높이 가중) 컬럼 선택 → 한쪽 쏠림 방지
4. **저축은 반대**: 사용자가 직접 ← → ↑ DROP으로 의식적 배치 (비대칭 ⭐ 핵심 메시지)
5. ★ **낱알(모노) 시스템** (1원~2만): 풀 안 거치고 1×1 낱알을 **`pickFillCell`** 로 가장 깊은 빈칸에 자동 끼워넣기
   - < 1만 → **기절한 흰 병아리** 낱알 (`mono-faint`, ghostNu) / 1만~2만 → **빨간 병아리** 낱알 (`mono-red`, spendNu)
   - 구멍을 메워 보드 수명을 늘림 / 착지 `mono-pop` 바운스 / 경계 `MONO_MAX = 20_000` (고정)
6. ★ **지출 줄 굳히기** (이전 "라인 클리어 금지"의 확장): 지출로 꽉 차운 줄은 사라지지 않고 **회색 콘크리트로 굳음** (`hardenFullRows`)
   - "쓴 돈은 화석처럼 남는다" / 굳는 순간 흔들림 + 토스트 / 저축 전용 줄은 안 굳음(보상 클리어 대상)
7. **저축 줄 클리어 유지**: 저축(노란 병아리)만으로 채운 줄은 보상으로 비움 (onRescue). → "지출은 못 지워도 저축은 비운다"
8. **수입 추가** → 목표 지출선이 위로 한 칸 bounce 애니메이션 + 합계 갱신

### 도형 ↔ 티어 매핑 (확정)
| 도형 | 티어 | 금액 | 카테고리 힌트 |
|------|------|------|---------------|
| I (일자) | red | 50만+ | 월세·큰결제 |
| L / J | orange | 10-50만 | 쇼핑·구독 |
| T / O | green | 5-10만 | 외식·교통 |
| S / Z | cyan | 1-5만 | 편의점·소품 |
| (없음) | blue | <1만 | 풀에만 누적 |

---

## 🏷️ 카테고리 체계 (9그룹 2-depth, ★ 확정)

> 자세한 매핑은 `handoff/04_CATEGORIES.md` 참조. `game-data.jsx`의 `CATEGORIES` 상수.

| top | sub |
|-----|-----|
| **RED** | 커피, 택시, 충동구매, 기타 |
| 생활 | 배달, 외식, 의료, 필수품, 장보기, 기타 |
| 커플 | 데이트비용, 기타 |
| 고정 | 통신, 보험, 기타 |
| 주거 | 월세, 대출이자, 기타 |
| 자기개발 | 취미, 건강, 미용, 기타 |
| 특별 | 이벤트, 여행, 경조사, 기타 |
| 반려동물 | 병원, 사료, 약값, 기타 |
| 구독 | OTT, 멤버십, 기타 |

수입: `[급여, 용돈, 부수입, 환급, 기타]` / 저축: `[적금, 비상금, 투자, 주택청약, 기타]`

- **RED 유지**: 충동/후회 지출 강조 라벨 (브랜드 일관성)
- **커플 유지**: 현재 하위 1개여도 향후 "선물/기념일" 추가 여지
- "기타"는 빠른 칩에 노출 X, 더보기 화면에서만
- top별 컬러: `TOP_COLORS` 상수 — 게임 티어 컬러와 별개의 분류 라벨용 (6px 점)

---

## 📝 입력 흐름 (바텀시트, ★ 확정)

> 자세한 사양은 `handoff/03_INPUT_AND_FAVORITES.md` 참조.

- 상단 **수입/지출/저축 칩** 자체가 입력 트리거 (각 칩 옆 펄스 `+` 어포던스)
- 칩 탭 → 시트가 **칩 위치에서 팝다운** (transform-origin: top, scale+fade 220ms)
- 시트는 **92% 불투명 + backdrop blur 3px** (뒤 보드가 흐릿하게 비침)
- 시트 윗변에 작은 꼬리(△) — 탭한 칩 위치(left 22%/50%/78%)로 이동
- 구성 (위→아래): 제목 / **★ 즐겨찾기 (가로 스크롤)** / 금액 디스플레이 / **빠른 칩 4개 + 더보기** / 날짜 / 숫자패드 3×4 / **★ 즐겨찾기 저장 토글** / 확인 버튼
- 달력 탭 폐기 → bottom-nav 3탭 (홈/통계/내정보)

### 즐겨찾기
- 데이터 모델: `{ id, type, label, amount, categoryTop, categorySub, usageCount, pinned? }`
- 사용횟수 내림차순 정렬, 3회+ 자동 📌 (`FAV_AUTO_PIN`)
- **1탭 → 자동 입력 + 380ms 후 자동 확정**
- 길게 누르기 → 이름·금액 수정 / 삭제 메뉴
- 초기 시드: `INITIAL_FAVORITES` (game-data.jsx)

### "즐겨찾기 저장" — 인라인 토글 ⭐
- 위치: **숫자패드와 확인 버튼 사이** 점선 박스
- ☆ → ★ 토글, 켠 상태로 확정 시 즐겨찾기에 즉시 추가
- 카테고리 미선택 / "기타"면 자동 비활성
- (이전 안이었던 하단 토스트는 폐기됨)

### 가로 스크롤 (PC 대응)
- 마우스 휠(세로) → 가로 변환
- 드래그(클릭+이동) → 가로 이동 (단 button 위에서 시작하면 통과)
- 좌·우 화살표 버튼 (`‹` `›`) — **스크롤 가능한 방향만 표시**, 클릭 시 70% 부드러운 이동
- 커서: `grab` / `grabbing`

---

## 📋 항목 보기/수정 (★ 확정)

> 자세한 사양은 `handoff/06_TRANSACTION_HISTORY.md` 참조.

- 진입점: **우측 RAGE 패널의 "지출 TOP 3" 바로 아래** 노란 점선 박스 "🐤 항목 보기/수정 →"
- 클릭 → **하단에서 슬라이드업** 리스트 시트 (높이 84%)
- 필터 탭 3종 (지출/수입/저축) + 개수 뱃지 + 합계
- 날짜별 그룹 (sticky 헤더)
- 각 행 탭 → **편집 시트** (= BottomSheet 재활용, `editing` prop)
  - 시트 제목 "지출 수정", 즐겨찾기 영역 숨김, 원본 배너 표시, 미리 채움
  - 하단 🗑️ 삭제 버튼 (한 번 더 확인 후 확정)
- ⚠️ **보드/풀 recompute는 Cursor 영역** (프로토타입은 합계 수치만 동기화)

---

## 디자인 시스템

### 컨셉
- 파스텔 톤 + 어두운 네이비 배경의 귀여운 게임 UI
- 모든 시각 요소가 "병아리 = 생명/돈" 은유

### 컬러
| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg-0` / `--bg-1` | `#0B1130` / `#131A40` | 페이지 배경 |
| `--pastel-yellow` | `#FFE899` | 저축 / 브랜드 |
| `--pastel-red` | `#FFA7AF` | 지출 / 분노 |
| `--pastel-blue` | `#B7C9FF` | 수입 |
| `--pastel-green` | `#C1EAC9` | 안전 |
| `--pastel-purple` | `#D7C0FF` | 회전 버튼 |

### 지출 티어 stroke
blue `#6E96FF` / cyan `#3FBBD8` / green `#5BBE80` / orange `#F08A4D` / red `#E54C5A` / save `#E5C04F`

### 타입
- 한글/UI: Pretendard Variable
- 숫자/모노: JetBrains Mono (`.num`, `.chip-val`, `.ac-num`, `.lt-num`, `.lr-amt` 등)

---

## 보드 스펙
- 그리드: **8 cols × 16 rows**, 셀 **26×26px** (미리보기, 기본 22), gap 1px
- 셀 borderRadius 5px, border 1.5px (티어 stroke)
- 목표 지출선: `GOAL_ROW = 5` (초기), 수입 증가 시 동적으로 위로 이동
- 자동 낙하 간격: `AUTO_FALL_MS = 700` (app.jsx)

## 게이지 계산 (수입 대비 백분율)
- 계란판: `round((income - expense + savingsBucket)/income × 18)` 알
- 분노 게이지: `round(expense/income × 100)`%
- saving 표시 = `savingsBucket` (★ 명시적 적립만 — 이전 `income - expense + savingsBucket` 폐기. 지출 입력해도 저축 불변. 잔여는 `freeCash`로 분리, 현 미표시)

## 패널 구성
- **좌측 (84px)**: SAVE / 계란판 (3×6) / 저축% / 적금 진행 / 스트릭
- **중앙**: 보드 위 풀 영역(공중 부양) + 보드
- **우측 (84px)**: RAGE / 유리관 / 분노% / **TOP 3 / 🐤 항목 보기/수정** 진입점
- **하단 컨트롤**: (활성 블록 있을 때만) 블록 카드 + 회전 버튼 / DROP / 저축 보상
- **bottom-nav**: 홈 / 통계 / 내 정보 (3탭, 균등 분할 `repeat(3,1fr)`)
- **통계 탭**(StatsScreen): RED 회고 카드 + 카테고리 도넋
- **내 정보 탭**(ProfileScreen): 프로필 / 월수입 슬라이더(→임계값 미리보기) / 목표저축률 / 테마선택(밤·낮) / 시작화면 다시보기 / 백업·CSV
- **테마**: 좌측 병아리 마스코트(계란판 아래) 탭 = 밤↔낮 토글. `data-theme` + localStorage `chick.theme`. 보드는 항상 다크.
- **랜딩**: 첫 실행만(`chick.seenLanding`) — 실제 Board 정지 히어로 + 시작하기, 페이드 전환 (handoff/10)

---

## 네이밍 규칙
- "테트리스" 단어 절대 사용 금지 → **"블록"**
- 브랜드명: **병아리 블록 가계부** (프로젝트명은 "병아리 테트리스 가계"지만 UI 표시는 "병아리 블록 가계부")

## 자주 만지는 곳
| 작업 | 위치 |
|------|------|
| 블록 임계값 비율 | `game-data.jsx` `TIER_RATIO` + `getThresholds` |
| 낱알 경계(2만)·흰↔빨강(1만) | `game-data.jsx` `MONO_MAX` / `MONO_RED` / `monoSubtype` |
| 스마트 배치·낱알 끼워넣기 | `game-data.jsx` `pickSmartCol` / `pickFillCell` |
| 지출 줄 굳히기 | `game-data.jsx` `hardenFullRows` |
| 테마 로직(밤↔낮) | `app.jsx` `toggleTheme` / `setTheme` |
| 랜딩 표시 제어 | `app.jsx` `showLanding` + localStorage `chick.seenLanding` (handoff/10) |
| 통계/내정보 화면 | `screens.jsx` `StatsScreen` / `ProfileScreen` |
| 도형↔티어 매핑 | `game-data.jsx` `SHAPE_BY_TIER` |
| 카테고리 추가/변경 | `game-data.jsx` `CATEGORIES` + `TOP_COLORS` |
| 빠른 칩 기본값 | `game-data.jsx` `DEFAULT_QUICK_SUBS` |
| 즐겨찾기 시드 | `game-data.jsx` `INITIAL_FAVORITES` |
| 거래 시드 (편집 데모용) | `app.jsx` 의 `transactions` 초기값 |
| 자동낙하 속도 | `app.jsx` `AUTO_FALL_MS` |
| 입력 시트 컴포넌트 | `components.jsx` `BottomSheet` |
| 리스트/편집 시트 | `components.jsx` `TransactionListSheet` |
| Tweaks 추가 | `app.jsx` `TWEAK_DEFAULTS` + `<TweaksPanel>` 자식. `useTweaks`는 **배열 destructure** |

## 알려진 안 한 것 / 향후 작업 후보 (대부분 Cursor 영역)
- ⚠️ **보드/풀 recompute**: 거래 수정·삭제 시 그 시점부터 시뮬레이션 다시 (handoff/06 §6)
- 저축 블록 수동 배치 흐름 (지금은 savingsBucket에 단순 누적만)
- 카테고리 더보기 풀 피커 인라인 펼침은 동작하나 UI 디테일 보강 여지
- ~~즐겨찾기 길게 누르기~~ (수정·삭제 구현 / 순서변경은 미구현)
- ⚠️ **보드 조기 포화**: 지출+저축이 수입보다 적은데도 칸이 일찍 차는 현상 (임계값/셀당 단가 조정 여지 — 사용자 지적)
- ★ **낱알 합치기**(보류): 보드 N% 차면 흰 낱알 모아 ≥1만 → 빨간 낱알 1칸 압축 (공간 회수) — 코어 안정 후 후속
- 통계 탭 확장 (캘린더 히트맵, 분노↔저축 트렌드, 블록 발생 카운트) — 현재 RED회고+도넛 2개
- ~~자동 추천~~ (`FAV_SUGGEST_COUNT` 3회 + 배너·토글 on)
- ~~날짜 칩 인라인 7일 펼침~~ (구현됨 — 오늘±3 + 다른 날짜)
- ~~거래 행 스와이프 좌측 → 삭제~~ (2탭 확정)
- "이번 달 폭망" 게임오버 시퀀스
- 자동 낙하 중력 타이머는 이미 있음, 속도 조절 옵션 추후

## 작업 시 주의
- 큰 리팩토링/리뉴얼 전에는 사용자에게 확인.
- `index.html`은 가벼운 셸 — 로직은 app.jsx / components.jsx에서만 수정.
- handoff/ 폴더의 결정사항을 코드보다 우선.
- standalone 배포 시 super_inline_html 사용. asset path → `window.__resources.*`로 치환하고 `<meta name="ext-resource-dependency">` 등록 필수.
