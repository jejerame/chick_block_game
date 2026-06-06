# 12 — 연간 풀 방어 트로피 (MVP)

## 성공 조건
- **해당 월**에 `applyPoolDeposit` → `tier != null` (풀에서 블록 실체화) **0회** → `win`
- 목표 지출선(`goalRow`)과 **무관**
- 50만+ 단일·2만 미만 낱알은 풀 우회 → 트로피 집계 제외

## 판정
- `game-data.jsx` → `deriveYearPoolBadges(transactions, year?)`
- 거래 `date`의 `YYYY-MM`로 월별 그룹, recompute와 동일 `simSpend` 풀 규칙

## UI
| 위치 | 컴포넌트 |
|------|----------|
| 홈 좌측 · 밤낮 마스코트 아래 | `YearBadgeStrip` `variant="compact"` |
| 통계 탭 상단 | `YearBadgeStrip` `variant="card"` |

- 성공: `assets/goldegg_nu.png`
- 실패: 빈 칸 / 이번 달: `pending` (풀 스폰 0이면 테두리 pulse)

## 데이터
- **진실**: `transactions` → `deriveYearPoolBadges`
- **백업**: `localStorage` `chick.poolTrophy.v1` — 거래 변경 시 연도별 스냅샷 자동 저장 (`savePoolTrophyYear`)
- **연도 탐색**: `badgeViewYear` + `‹ ›` — `collectBadgeYears` (거래·저장소·올해 합집합)
- **기록 없음**: 과거 월·거래 0건 → `empty` (무조건 win 아님)

## 인터랙션
- 칸 탭 → `pt-detail-toast` 2.8초 (홈·통계 각 컴포넌트 내)
- `future` 칸은 탭 불가
