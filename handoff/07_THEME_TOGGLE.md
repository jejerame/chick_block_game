# 07 — 낮/밤 모드 (테마 토글)

> Cursor 작업 지시서. 프로토타입 구현은 `app.jsx` + `screens.jsx` + `components.jsx` + `styles.css` 참조.

---

## 1. 컨셉

> **"병아리는 낮엔 활동하고, 밤엔 쉰다"** — 마스코트를 그대로 테마 토글에 사용.

- 두 모드의 정체성:
  - **낮 모드 (Light)** : 따뜻한 크림/베이지 톤. 가계부를 '관리하는 도구'로 느끼게.
  - **밤 모드 (Dark)** : 짙은 네이비 게임 캔버스. 가계부를 '몰입형 게임'으로 느끼게. (기본값)
- ⚠️ **보드는 항상 다크**. 라이트 모드여도 게임존(보드/사이드 패널/풀존/활성 카드)은 다크 카드로 띄움. 닌텐도 스위치도 다크 게임 화면을 유지하는 컨벤션과 같음.

---

## 2. 토글 위치 · UI

### 위치
- **좌측 사이드 패널 (계란판) 맨 아래**
- 12일 스트릭 라인 아래 점선 separator + 마스코트 카드
- bottom-nav나 헤더가 아닌, 사이드 패널 안에 배치한 이유: 헤더는 수입/지출/저축 칩으로 꽉 차 있고, 좌측 패널은 SAVE(저축·계란판) 컨텍스트라 "병아리 = 자산" 메타포의 연장으로 자연스러움.

### 마스코트 (이미지 사용)
| 모드 | 이미지 | 의미 |
|-----|--------|------|
| 낮 (light) | `assets/chick_day.png` (선글라스 쓴 노란 병아리) | 활동 중 |
| 밤 (dark) | `assets/chick_night.png` (잠자는 병아리) | 휴식 중 |

### 라벨 (★ 확정)
- 큰 라벨: `DAY` / `NIGHT` (JetBrains Mono, 9px, letter-spacing 0.16em)
- 보조: `"현재 낮 모드"` / `"현재 밤 모드"` (8.5px, ink-3)
- ⚠️ **"활동 중 / 잠자는 중"은 폐기** — 사용자가 "잠자는 중"을 "기능 OFF"로 오해할 수 있음. 마스코트 라벨은 *현재 상태*만 직설적으로 표현. 귀여움은 마스코트 일러스트 자체로 충분.

### 인터랙션
- 1탭 → 모드 전환 (즉시)
- 마스코트 이미지가 `opacity + rotate(8deg)` 크로스페이드로 교차 (400ms)
- hover 시 살짝 위로 (`translateY(-1px) scale(1.03)`)
- active 시 `scale(0.96)`

### 중복 노출
- **내 정보 화면**에도 같은 토글이 `action-btn` 형태로 한 번 더 등장 (`낮 모드 / 밤 모드` + 보조 텍스트 `"현재 낮 모드 · 탭해서 밤으로 전환"`).
- 사이드 패널은 항상 보이는 즉시성, 내 정보는 설정 컨텍스트. 둘 다 같은 `toggleTheme()` 호출.

---

## 3. 구현

### 3-1. 상태 · 영속화
```js
// app.jsx
const [theme, setTheme] = useState(() => {
  const saved = localStorage.getItem("chick.theme");
  if (saved === "dark" || saved === "light") return saved;
  return tweaks.theme === "light" ? "light" : "dark"; // Tweaks 디폴트
});

useEffect(() => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("chick.theme", theme);
}, [theme]);

const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
```

- 영속화 키: **`chick.theme`** (localStorage)
- 시스템 다크 모드 감지(`prefers-color-scheme`)는 일부러 사용 안 함 — 게임 정체성상 다크가 기본값이라 강제하지 않음.
- Tweaks 패널에도 동일 키(`theme`) 노출 → 둘 중 어디서 바꿔도 동기화.

### 3-2. CSS 토큰 스코프
- `:root` → 다크 토큰 (기존 그대로 유지)
- `:root[data-theme="light"]` → 라이트용 오버라이드
- 셸/헤더/네비/시트/스크린은 자동으로 라이트 톤 적용

```css
[data-theme="light"] body { /* 크림 그라데이션 */ }
[data-theme="light"] .app-shell { background: linear-gradient(...크림); }
[data-theme="light"] .bottom-sheet { background: 크림 100%; }
```

### 3-3. ★ 다크 유지 영역 (게임 컨텍스트)
보드/사이드패널/풀존/활성카드는 라이트 모드에서도 **다크 카드처럼 떠 있어야** 함. 컨테이너 스코프에서 ink 변수를 다크용으로 재정의:

```css
[data-theme="light"] .side-panel,
[data-theme="light"] .pool-zone {
  --ink:   #F4F6FF;
  --ink-2: #C7CDF0;
  --ink-3: #8A92C2;
  --ink-4: #525B8A;
  color: var(--ink);
}
[data-theme="light"] .side-panel {
  background: linear-gradient(180deg, rgba(15, 22, 60, 0.94), rgba(11, 17, 48, 0.96));
  border-color: rgba(255, 255, 255, 0.10);
  box-shadow: 0 4px 16px rgba(40, 30, 10, 0.18);  /* 라이트 셸 위 부유감 */
}
[data-theme="light"] .pool-zone {
  background: rgba(11, 17, 48, 0.55);
  border-radius: 10px;
}
```

→ **셸/시트/네비는 라이트, 보드 영역은 다크 카드**로 분리되는 하이브리드 레이아웃.

---

## 4. 라이트 모드 컬러 토큰 (확정)

| 토큰 | 다크 (기존) | 라이트 (신규) | 용도 |
|------|-------------|---------------|------|
| 배경 그라데이션 | `#0B1130 → #131A40` | `#FFF8E2 → #FBF1CF → #FFF6DA` | 페이지 셸 |
| ink (본문) | `#F4F6FF` | `#2B2718` | 주 텍스트 |
| ink-2 | `#C7CDF0` | `#4D4734` | 부 텍스트 |
| ink-3 | `#8A92C2` | `#8A7B5A` | 보조 라벨 |
| panel | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.7)` | 카드 배경 |
| border | `rgba(255,255,255,0.08)` | `rgba(150,130,80,0.20)` | 카드 외곽 |
| stat 칩 (지출 빨강) | `--pastel-red` | `#D14E58` (라이트에선 더 진하게) | 가독성 보정 |
| stat 칩 (저축 노랑) | `--pastel-yellow` | `#C99B17` | 가독성 보정 |
| stat 칩 (수입 파랑) | `--pastel-blue` | `#4A6CD4` | 가독성 보정 |

> Pastel(`--pastel-*`) 변수는 **브랜드 컬러라 유지**. 다만 라이트 모드에선 그 색을 그대로 텍스트로 쓰지 않고, 텍스트는 진한 톤으로 별도 지정.

### 게임 티어 stroke (불변)
- 다크/라이트 어디서나 동일: cyan `#3FBBD8` / green `#5BBE80` / orange `#F08A4D` / red `#E54C5A` / save `#E5C04F`
- 보드는 항상 다크 컨텍스트라 stroke 보정 불필요.

---

## 5. 검증 체크리스트

- [ ] 좌측 패널 SAVE 박스, 알 수, 분노 게이지, 풀존, 활성 블록 카드 텍스트가 라이트 모드에서 **잘 보이는지** (라이트 ink 변수가 새어들면 거의 안 보임)
- [ ] 헤더 stat-chip 3종 모두 라이트에서 색 가독성 유지
- [ ] BottomSheet 열어서 펄스 + 즐겨찾기 칩 + 빠른 카테고리 + 숫자패드 다 라이트 톤으로 보이는지
- [ ] 항목 보기 시트(TransactionListSheet)도 라이트 톤
- [ ] 통계·내정보 화면 카드들 라이트 톤
- [ ] localStorage 비운 첫 진입은 다크가 기본값
- [ ] 새로고침 후 직전 모드 복원
- [ ] iPhone 노치 영역 색 (status-bar 영역)이 모드에 따라 어울리는지

---

## 6. 향후 확장 후보

- **자동 모드** — 사용자의 시스템 prefers-color-scheme 감지 (지금은 끔)
- **시간대별 자동 전환** — 사용자 설정 시간 (예: 22시~6시 밤)
- **모드별 사운드** — 밤 모드에선 모든 효과음 볼륨 30% 감쇠
- **저녁 회고 알림** — 밤 모드 전환 시 "오늘 RED N건" 토스트
