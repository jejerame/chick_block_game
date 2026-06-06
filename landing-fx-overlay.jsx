/* global React */
/**
 * ═══ 랜딩 Aurora 연출 (선택) ═══
 *
 * 끄기: 아래 false → 저장 후 새로고침 (DOM·CSS는 남음, 화면에만 안 그림)
 * 완전 제거:
 *   1) LANDING_AURORA_ENABLED = false (또는 이 파일 삭제)
 *   2) index.html 의 landing-fx-overlay.jsx <script> 한 줄 삭제
 *   3) styles.css 에서 "BEGIN LANDING AURORA" ~ "END LANDING AURORA" 블록 삭제
 *
 * 스타일: styles.css `.landing-aurora-*` (속도·흐름은 그 파일에서 조정)
 */
(function () {
  /** @type {boolean} — false면 연출 없음, 가계부는 그대로 동작 */
  const LANDING_AURORA_ENABLED = true;

  function LandingFxOverlay() {
    if (!LANDING_AURORA_ENABLED) return null;

    return (
      <div className="landing-aurora" aria-hidden="true">
        <div className="landing-aurora-base" />
        <div className="landing-aurora-waves">
          <div className="landing-aurora-wave landing-aurora-wave--1" />
          <div className="landing-aurora-wave landing-aurora-wave--2" />
          <div className="landing-aurora-wave landing-aurora-wave--3" />
          <div className="landing-aurora-wave landing-aurora-wave--4" />
        </div>
        <div className="landing-aurora-depth" />
      </div>
    );
  }

  Object.assign(window, { LandingFxOverlay, LANDING_AURORA_ENABLED });
})();
