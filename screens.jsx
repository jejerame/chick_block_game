/* global React, GAME */
(function(){
const { useMemo, useRef } = React;
const { TOP_COLORS, getThresholds, TIER_RATIO } = window.GAME;

const fmtTierPct = (ratio) => {
  const p = ratio * 100;
  return Number.isInteger(p) ? `${p}%` : `${p.toFixed(1)}%`;
};

const __R = window.__resources || {};
const CHICK = {
  save:    __R.chickSave    || "assets/chick_save.png",
  spendNu: __R.chickSpendNu || "assets/chick_spend_nu.png",
  ghostNu: __R.chickGhostNu || "assets/chick_ghost_nu.png",
  day:     __R.chickDay     || "assets/chick_day.png",
  night:   __R.chickNight   || "assets/chick_night.png",
  goldEgg: __R.goldEgg      || "assets/goldegg_nu.png",
};

const fmtKRW = (n) => {
  if (n >= 10000) return Math.round(n / 10000 * 10) / 10 + "만";
  if (n >= 1000) return (n / 1000).toFixed(0) + "천";
  return n.toLocaleString();
};

/** 구글폼 피드백 — 응답용 viewform URL */
const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfTk21M6_RX-cIjkJgqOupABJOIXkFZfWHvx6GZVLkYkGF6KQ/viewform";

// ── STATS SCREEN ────────────────────────────────────────────────
function StatsScreen({ transactions }) {
  // 카테고리 도넛 (top 별 합계)
  const byTop = {};
  transactions.filter((t) => t.type === "spend").forEach((t) => {
    byTop[t.categoryTop] = (byTop[t.categoryTop] || 0) + t.amount;
  });
  const entries = Object.entries(byTop)
    .map(([cat, amt]) => ({ cat, amt, color: TOP_COLORS[cat] || "#999" }))
    .sort((a, b) => b.amt - a.amt);
  const totalExp = entries.reduce((s, e) => s + e.amt, 0);

  // 도넛 SVG dash 계산
  const R = 50;
  const CIRC = 2 * Math.PI * R;
  let acc = 0;
  const segs = entries.map((e) => {
    const frac = totalExp > 0 ? e.amt / totalExp : 0;
    const len  = frac * CIRC;
    const seg = { ...e, frac, len, offset: -acc };
    acc += len;
    return seg;
  });

  return (
    <div className="app-screen">
      {/* 카테고리 도넛 */}
      <div className="screen-section">
        <div className="section-eyebrow">CATEGORY · DONUT</div>
        <div className="section-title">어디에 가장 많이 썼나요?</div>

        <div className="donut-wrap">
          <svg className="donut-svg" viewBox="0 0 120 120">
            <circle className="donut-track" cx="60" cy="60" r={R} />
            {segs.map((s, i) => (
              <circle
                key={i}
                className="donut-seg"
                cx="60" cy="60" r={R}
                stroke={s.color}
                strokeDasharray={`${s.len} ${CIRC}`}
                strokeDashoffset={s.offset}
                transform="rotate(-90 60 60)"
                strokeLinecap="butt"
              />
            ))}
            <text className="donut-center" x="60" y="58">{fmtKRW(totalExp)}</text>
            <text className="donut-center-sub" x="60" y="74">총 지출</text>
          </svg>
          <div className="donut-legend">
            {segs.slice(0, 6).map((s) => (
              <div key={s.cat} className="dl-row">
                <span className="dl-dot" style={{ background: s.color }} />
                <span className="dl-cat">{s.cat}</span>
                <span className="dl-pct">{Math.round(s.frac * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PROFILE SCREEN ──────────────────────────────────────────────
function ProfileScreen({
  income, onIncomeChange,
  totalEggs,
  onExportJsonBackup, onImportJsonBackup, onExportCsv, onResetTestAmounts,
  transactionCount = 0,
}) {
  const importInputRef = useRef(null);
  const thresholds = getThresholds(income);

  return (
    <div className="app-screen">
      <div className="profile-hero-row">
        <div className="profile-card profile-card--main">
          <div className="pf-avatar">
            <img src={CHICK.save} alt="" />
          </div>
          <div className="pf-meta">
            <div className="pf-name">병아리지기 🐤</div>
            <div className="pf-since">since 2026.01 · 5개월째</div>
            <div className="pf-stats">
              <div>
                <div className="pf-stat-num">{totalEggs}</div>
                <div className="pf-stat-cap">누적 알</div>
              </div>
              <div>
                <div className="pf-stat-num">12</div>
                <div className="pf-stat-cap">최장 스트릭</div>
              </div>
              <div>
                <div className="pf-stat-num">{Math.round(income / 10_000)}</div>
                <div className="pf-stat-cap">월 수입(만)</div>
              </div>
            </div>
          </div>
        </div>
        <a
          className="profile-card profile-feedback-card"
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="피드백 설문 열기"
        >
          <span className="pfb-icon" aria-hidden="true">📝</span>
          <span className="pfb-title">피드백</span>
          <span className="pfb-sub">1분 설문</span>
        </a>
      </div>

      {/* 월 수입 설정 + 임계값 미리보기 (블록 크기) */}
      <div className="screen-section sr-income">
        <div className="section-eyebrow">INCOME · BLOCK SIZE</div>
        <div className="section-title">월 수입 설정</div>

        <div className="setting-row">
          <div className="sr-label">
            <span>이번 달 수입</span>
            <span className="sr-val income">{Math.round(income / 10_000)}만원</span>
          </div>
          <input
            type="range"
            className="sr-slider"
            min={0}
            max={10_000_000}
            step={100_000}
            value={Math.max(0, income)}
            onChange={(e) => onIncomeChange(parseInt(e.target.value, 10))}
          />
          <div className="sr-hint">
            <b>상단 수입 칩</b>과 항상 연동돼요. 여기서 조절하면 수입 거래가 바뀌고, 블록·목표선·계란판도 같이 맞춰집니다.
          </div>
          <div className="threshold-preview">
            <div className="tp-chip cyan">
              <div className="tp-tier">CYAN · {fmtTierPct(TIER_RATIO.cyan)}</div>
              <div className="tp-amt">{fmtKRW(thresholds.cyan)}</div>
            </div>
            <div className="tp-chip green">
              <div className="tp-tier">GREEN · {fmtTierPct(TIER_RATIO.green)}</div>
              <div className="tp-amt">{fmtKRW(thresholds.green)}</div>
            </div>
            <div className="tp-chip orange">
              <div className="tp-tier">ORANGE · {fmtTierPct(TIER_RATIO.orange)}</div>
              <div className="tp-amt">{fmtKRW(thresholds.orange)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 백업 */}
      <div className="screen-section">
        <div className="section-eyebrow">PREFERENCES</div>
        <div className="section-title">기본 설정</div>

        <div style={{ height: 8 }} />

        <button type="button" className="action-btn" onClick={() => onExportJsonBackup?.()}>
          <div className="ab-icon" style={{ background: "rgba(184, 230, 193, 0.18)" }}>☁️</div>
          <div className="ab-body">
            <div>JSON 백업 저장</div>
            <div className="ab-sub">거래·수입·설정 한 파일 · {transactionCount}건</div>
          </div>
          <span className="ab-arrow">⤓</span>
        </button>

        <div style={{ height: 8 }} />

        <button
          type="button"
          className="action-btn"
          onClick={() => importInputRef.current?.click()}
        >
          <div className="ab-icon" style={{ background: "rgba(183, 201, 255, 0.18)" }}>📂</div>
          <div className="ab-body">
            <div>JSON 복원</div>
            <div className="ab-sub">저장해 둔 백업 파일 선택</div>
          </div>
          <span className="ab-arrow">›</span>
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only-file"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) onImportJsonBackup?.(f);
            e.target.value = "";
          }}
        />

        <div style={{ height: 8 }} />

        <button type="button" className="action-btn" onClick={() => onExportCsv?.()}>
          <div className="ab-icon" style={{ background: "rgba(215, 192, 255, 0.18)" }}>⤓</div>
          <div className="ab-body">
            <div>CSV로보내기</div>
            <div className="ab-sub">엑셀용 · 거래 목록만</div>
          </div>
          <span className="ab-arrow">⤓</span>
        </button>

        <div style={{ height: 8 }} />

        <button type="button" className="action-btn" onClick={() => onResetTestAmounts?.()}>
          <div className="ab-icon" style={{ background: "rgba(255, 167, 175, 0.18)" }}>🧪</div>
          <div className="ab-body">
            <div>테스트 금액 초기화</div>
            <div className="ab-sub">넣어둔 수입·지출·저축 전부 삭제 · 배포 전 임시</div>
          </div>
          <span className="ab-arrow">↺</span>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { StatsScreen, ProfileScreen });
})();
