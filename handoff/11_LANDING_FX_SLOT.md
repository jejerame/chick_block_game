# 11 — 랜딩 연출 슬롯 (캡처 위 · 카피 아래)

> 안정 랜딩(`landing--simple`) 위에 **외부 연출만** 끼워 넣는 자리. THREE/셰이더는 기본 로드하지 않음.

**현재 구현:** `landing-fx-overlay.jsx` → Aurora 보라 파동 (`styles.css` `BEGIN LANDING AURORA` 블록)

**끄기:** `landing-fx-overlay.jsx` → `LANDING_AURORA_ENABLED = false`  
**완전 제거:** 위 false + `index.html` script 줄 + `styles.css` Aurora 블록 삭제

## 레이어 순서 (아래 → 위)

| z-index | 요소 | 설명 |
|--------|------|------|
| 0 | `landing-backdrop-blur` | 뒤 실제 앱(블록 보드) + 블러 |
| 1 | `landing-capture-zone` | 캡처가 보이는 영역(마스크·가이드) |
| 2 | `landing-fx-slot` → **`LandingFxOverlay`** | ★ 여기에 애니메이션 |
| 5 | `landing-copy-anchor` | 글래스 텍스트 박스 + 시작하기 |

## 연결 방법

1. `landing-fx-overlay.jsx` 의 `LandingFxOverlay` 구현
2. `index.html` 에 스크립트 추가 (**`components.jsx` 보다 위**):

```html
<script type="text/babel" data-presets="react" src="landing-fx-overlay.jsx"></script>
<script type="text/babel" data-presets="react" src="components.jsx"></script>
```

3. 연출 컴포넌트는 `window.LandingFxOverlay` 로 노출:

```js
function LandingFxOverlay() {
  return <div className="my-fx" style={{ position:"absolute", inset:0 }}>...</div>;
}
Object.assign(window, { LandingFxOverlay });
```

## 캡처(보드) 데이터

- 랜딩 중 `app.jsx` 가 `landingHeroGrid` 로 메인 보드를 채움 (`landingBackdrop`)
- 별도 PNG 없이 **뒤 게임 화면이 곧 캡처**임
- 연출은 `.landing-fx-slot` 안에서만 그리기 (전체 `App` 크래시 방지)

## 주의

- `@react-three/fiber` / shadcn / Tailwind 빌드는 이 프로젝트에 없음 → **vanilla JS, canvas, CSS animation** 권장
- 실패 시 `LandingFxOverlay` 를 `return null` 로 두면 가계부는 정상 동작
