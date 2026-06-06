# 05 · 가로 스크롤 UX (PC 마우스 휠 / 드래그 지원)

> Cursor 작업 지시서 (5편). 즐겨찾기 / 카테고리 빠른 칩 가로 스크롤 영역의 PC 데스크탑 사용성.

---

## 1. 문제

모바일 가계부 앱이지만 **시뮬레이터·웹 미리보기·태블릿 가로 모드**에서도 사용됨. 가로 스크롤 영역(`.fav-scroll`, `.cat-row`)이:
- 터치 디바이스: 손가락 스와이프로 자연스럽게 스크롤됨 ✅
- PC 마우스: **세로 휠은 안 먹고, 스크롤바도 숨겨놨으니** 끝까지 볼 방법이 없음 ❌

→ 즐겨찾기 추가가 잘 됐는지 확인 못 함, 카테고리 칩 끝까지 못 보고 입력 못 하는 등의 답답함.

---

## 2. 해결책 (★ 사용자 확정 / 구현됨)

가로 스크롤 영역에 **3가지 입력 모드**를 모두 지원:

### (a) 터치 스와이프 — 기본
모바일에선 그대로. `overflow-x: auto` + `-webkit-overflow-scrolling: touch` (필요시).

### (b) 마우스 휠 → 가로 스크롤 변환
- 영역 위에서 마우스 휠을 굴리면 **세로 deltaY가 가로 scrollLeft로 변환**됨.
- 가로 휠(deltaX)이 더 크면 그건 그대로 사용 (트랙패드 가로 제스처 보존).
- 영역 밖에선 평소대로 페이지 세로 스크롤.

```js
const onWheel = (e) => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }
};
```

### (c) 드래그 (mousedown + mousemove → scrollLeft)
- 영역 위에서 **마우스 드래그**로 가로 이동 가능. iOS 시뮬레이터 / 비-터치 환경 대응.
- 단, `<button>` 등 인터랙티브 요소 위에서 시작한 클릭은 드래그로 가로채지 않음 (탭 동작 살림).

```js
const onDown = (e) => {
  if (e.target.closest("button")) return; // 버튼 클릭은 통과
  isDown = true;
  startX = e.clientX;
  startScroll = el.scrollLeft;
};
const onMove = (e) => {
  if (!isDown) return;
  el.scrollLeft = startScroll - (e.clientX - startX);
};
```

### (d) 커서 단서
- 영역 위 hover: `cursor: grab`
- 드래그 중: `cursor: grabbing`
- "이 영역은 잡고 끌 수 있다"는 어포던스 제공.

### (e) 양방향 스크롤 화살표 (좌/우) ⭐
- 즐겨찾기 행 좌우 끝에 **클릭 가능한 chevron 버튼** (`‹` 좌측, `›` 우측)
- **스크롤 가능한 방향만 표시**: `scrollLeft > 4` 이면 좌측 노출, `scrollLeft < scrollWidth - clientWidth - 4` 이면 우측 노출
- 좌측은 우측 그라데이션 반대 방향, 흔들림 애니메이션도 reverse
- 2.4s 좌우 흔들림 애니메이션 — "여기 누를 수 있어요" 어포던스
- 클릭하면 **자기 너비의 70%만큼 부드럽게 스크롤** (해당 방향)
- 자체 그라데이션 배경으로 뒤에 있는 칩과 시각적 분리 → **클릭 통과(click-through) 없음**
- hover: 글자색 → 흰색 + 안쪽으로 살짝 이동 / active: scale 0.92로 축소

### 상태 추적 구현
```js
const [favCanL, setFavCanL] = useState(false);
const [favCanR, setFavCanR] = useState(false);

useEffect(() => {
  const el = favScrollRef.current;
  if (!el) return;
  const check = () => {
    setFavCanL(el.scrollLeft > 4);
    setFavCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };
  check();
  const t = setTimeout(check, 60); // 마운트 직후 정확 측정
  el.addEventListener("scroll", check);
  window.addEventListener("resize", check);
  return () => { clearTimeout(t); el.removeEventListener("scroll", check); window.removeEventListener("resize", check); };
}, [favorites.length, type]);
```

---

## 3. 적용 대상

| 영역 | 클래스 | 비고 |
|------|--------|------|
| 즐겨찾기 가로 칩 | `.fav-scroll` | 위 4모드 전부 적용. 우측 chevron 단서. |
| 카테고리 빠른 칩 | `.cat-row` | 동일. 단 기본 4칩 + 더보기 = 5칸이라 스크롤 거의 안 됨. |
| 풀 피커 sub-카테고리 | `.cat-sub-row` | 현재 wrap이라 스크롤 X. 추후 변경 시 동일 패턴 적용. |

---

## 4. React 구현 (BottomSheet 내부)

`useRef`로 두 스크롤 영역 참조 후, `useEffect`에서 이벤트 리스너 한 번 등록:

```jsx
const favScrollRef = useRef(null);
const catScrollRef = useRef(null);

useEffect(() => {
  const wireUp = (el) => {
    if (!el) return () => {};
    /* onWheel / onDown / onMove / onUp 등록 */
  };
  const c1 = wireUp(favScrollRef.current);
  const c2 = wireUp(catScrollRef.current);
  return () => { c1(); c2(); };
}, [showFull]); // 더보기 토글 시 cat-row가 unmount되므로 의존성에 포함

return (
  <>
    <div className="fav-scroll" ref={favScrollRef}>...</div>
    <div className="cat-row"    ref={catScrollRef}>...</div>
  </>
);
```

---

## 5. 접근성

- 키보드 사용자: 칩이 `<button>`이라 Tab으로 이동 + Enter/Space로 선택 가능. 가로 스크롤은 키보드로는 불필요 (Tab만 잘 작동하면 OK).
- 스크린 리더: 단순한 가로 리스트라 `role="list"` 등 추가는 선택 사양. 현재 미적용.

---

## 6. 검수 시나리오

### PC
1. 시트 열기 → 즐겨찾기 우측에 `›` 애니메이션 보임
2. 즐겨찾기 영역에 마우스 올리고 휠 굴림 → **가로로 스크롤**됨 (페이지 스크롤 X)
3. 영역을 마우스로 잡고 좌우로 드래그 → 가로 이동
4. 칩 자체를 클릭 → 드래그가 아니라 칩 탭으로 인식 (즉시 입력)

### 모바일/터치
- 평소대로 손가락 스와이프

### 트랙패드
- 가로 두 손가락 스와이프 = 가로 스크롤 (e.deltaX 그대로 처리)
- 세로 두 손가락 스와이프도 가로로 변환됨 — 큰 영역에선 페이지 스크롤이 우선이므로 OK

---

## 7. 알려진 한계 / 추후 개선

- 드래그 중 좌측 끝/우측 끝에서 멈출 때 약한 진동 효과 (overscroll bounce) 없음 — 추후 옵션
- 휠로 가로 스크롤 시 native scroll-snap 미적용 — 칩 단위 정렬은 안 되고 픽셀 단위로 흐름. 자연스러운 편이지만 원하면 `scroll-snap-type: x mandatory` + `scroll-snap-align: start` on chips 추가 가능
- 우측 chevron(`›`)은 즐겨찾기에만 표시. 카테고리 빠른 칩은 5칸 안에 다 들어가므로 생략.

---

끝.
