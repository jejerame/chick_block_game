/* global React, GAME */
(function(){
const { useMemo } = React;
const { TOP_COLORS, getThresholds } = window.GAME;

const __R = window.__resources || {};
const CHICK = {
  save:    __R.chickSave    || "assets/chick_save.png",
  spendNu: __R.chickSpendNu || "assets/chick_spend_nu.png",
  ghostNu: __R.chickGhostNu || "assets/chick_ghost_nu.png",
  day:     __R.chickDay     || "assets/chick_day.png",
  night:   __R.chickNight   || "assets/chick_night.png",
};

const fmtKRW = (n) => {
  if (n >= 10000) return Math.round(n / 10000 * 10) / 10 + "만";
  if (n >= 1000) return (n / 1000).toFixed(0) + "천";
  return n.toLocaleString();
};

// ── STATS SCREEN ────────────────────────────────────────────────
function StatsScreen({ transactions, income, expense }) {
  // RED 회고: categoryTop === "RED" 인 항목
  const redItems = transactions
    .filter((t) => t.type === "spend" && t.categoryTop === "RED")
    .sort((a, b) => b.amount - a.amount);
  const redTotal = redItems.reduce((s, t) => s + t.amount, 0);
  const redPct   = income > 0 ? Math.round(redTotal / income * 100 * 10) / 10 : 0;
  const topRed   = redItems.slice(0, 3);

  const recapQuote = redTotal === 0
    ? "이번 달은 RED가 0원이야. 병아리가 평온하게 잠들겠는데?"
    : redTotal < 30_000
      ? "충동 지출이 잘 통제됐어. 이 페이스를 유지해 보자."
      : redTotal < 100_000
        ? "RED 라벨이 슬슬 쌓이고 있어. 커피·택시는 의식적으로 줄여 보자."
        : "후회가 큰 항목이 꽤 쌓였어. 한 번 돌아보고 다음 주는 조정해 보자.";

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
      {/* RED 회고 카드 */}
      <div className="red-recap">
        <div className="rr-head">
          <div>
            <div className="rr-eyebrow">RED · 회고 카드</div>
            <div className="rr-title">충동·후회 지출을<br/>이만큼 했어요</div>
          </div>
          <div className="rr-chick">
            <img src={redTotal > 50_000 ? CHICK.ghostNu : CHICK.spendNu} alt="" />
          </div>
        </div>
        <div>
          <span className="rr-big">{redTotal.toLocaleString()}</span>
          <span className="rr-big-unit">원 · 수입의 {redPct}%</span>
        </div>
        <div className="rr-sub">5월 1일 ~ 26일 · {redItems.length}건</div>

        {topRed.length > 0 && (
          <div className="rr-top-items">
            {topRed.map((t) => (
              <div key={t.id} className="rr-item">
                <span className="rr-item-dot" />
                <span className="rr-item-cat">{t.categorySub}</span>
                <span className="rr-item-amt">{t.amount.toLocaleString()}원</span>
              </div>
            ))}
          </div>
        )}

        <div className="rr-quote">{recapQuote}</div>
      </div>

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
  savingsGoalPct, onSavingsGoalChange,
  totalEggs,
  theme, onToggleTheme,
}) {
  const thresholds = getThresholds(income);

  return (
    <div className="app-screen">
      {/* 프로필 카드 */}
      <div className="profile-card">
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
            min={1_000_000}
            max={10_000_000}
            step={100_000}
            value={income}
            onChange={(e) => onIncomeChange(parseInt(e.target.value, 10))}
          />
          <div className="sr-hint">
            수입에 따라 <b>블록 크기(임계값)</b>가 자동 조정돼요 — 어느 수입이든 한 블록이 비슷한 비중을 차지하도록.
          </div>
          <div className="threshold-preview">
            <div className="tp-chip cyan">
              <div className="tp-tier">CYAN · 1.5%</div>
              <div className="tp-amt">{fmtKRW(thresholds.cyan)}</div>
            </div>
            <div className="tp-chip green">
              <div className="tp-tier">GREEN · 3%</div>
              <div className="tp-amt">{fmtKRW(thresholds.green)}</div>
            </div>
            <div className="tp-chip orange">
              <div className="tp-tier">ORANGE · 15%</div>
              <div className="tp-amt">{fmtKRW(thresholds.orange)}</div>
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div className="sr-label">
            <span>목표 저축률</span>
            <span className="sr-val">{savingsGoalPct}%</span>
          </div>
          <input
            type="range"
            className="sr-slider"
            min={5} max={50} step={5}
            value={savingsGoalPct}
            onChange={(e) => onSavingsGoalChange(parseInt(e.target.value, 10))}
          />
          <div className="sr-hint">
            매달 수입의 <b>{savingsGoalPct}%</b>({fmtKRW(income * savingsGoalPct / 100)}원)를 계란판에 채우는 게 목표예요.
          </div>
        </div>
      </div>

      {/* 테마 + 백업 */}
      <div className="screen-section">
        <div className="section-eyebrow">PREFERENCES</div>
        <div className="section-title">기본 설정</div>

        <button className="action-btn" onClick={onToggleTheme}>
          <div className="ab-icon" style={{ background: theme === "dark" ? "rgba(183, 201, 255, 0.16)" : "rgba(255, 232, 153, 0.22)" }}>
            <img src={theme === "dark" ? CHICK.night : CHICK.day} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
          </div>
          <div className="ab-body">
            <div>{theme === "dark" ? "밤 모드" : "낮 모드"}</div>
            <div className="ab-sub">{theme === "dark" ? "현재 밤 모드 · 탭해서 낮으로 전환" : "현재 낮 모드 · 탭해서 밤으로 전환"}</div>
          </div>
          <span className="ab-arrow">›</span>
        </button>

        <div style={{ height: 8 }} />

        <button className="action-btn" onClick={() => alert("백업 시뮬레이션 — 실제 동작은 Cursor 영역")}>
          <div className="ab-icon" style={{ background: "rgba(184, 230, 193, 0.18)" }}>☁️</div>
          <div className="ab-body">
            <div>데이터 백업</div>
            <div className="ab-sub">마지막 동기화 · 어제 23:42</div>
          </div>
          <span className="ab-arrow">›</span>
        </button>

        <div style={{ height: 8 }} />

        <button className="action-btn" onClick={() => alert("내보내기 시뮬레이션")}>
          <div className="ab-icon" style={{ background: "rgba(215, 192, 255, 0.18)" }}>⤓</div>
          <div className="ab-body">
            <div>CSV로 내보내기</div>
            <div className="ab-sub">엑셀에서 열어보기</div>
          </div>
          <span className="ab-arrow">›</span>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { StatsScreen, ProfileScreen });
})();
