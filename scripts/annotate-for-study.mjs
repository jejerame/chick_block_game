/**
 * game-data.jsx, app.jsx → study/annotated/ 에 초보용 한국어 주석 블록 삽입
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "study", "annotated");
mkdirSync(OUT, { recursive: true });

const GAME_HEADER = `/*
╔══════════════════════════════════════════════════════════════════╗
║  game-data.jsx — 학습용 주석판 (원본: 루트/game-data.jsx)        ║
╠══════════════════════════════════════════════════════════════════╣
║  【이 파일의 역할】                                               ║
║  가계부 게임의 "법칙서 + 계산기"입니다.                           ║
║  - 보드 크기, 티어, 풀 임계값, 도형 모양                          ║
║  - 거래 목록 → 보드·풀·기절을 계산하는 deriveGameState ★핵심★    ║
║  - 카테고리, 즐겨찾기 시드, 저장/백업                             ║
║                                                                  ║
║  【읽는 순서 추천】                                               ║
║  1) 상수 COLS, ROWS, TIER_RATIO                                  ║
║  2) targetBoardCells, getThresholds, applyPoolDeposit             ║
║  3) simulateSpendStep → deriveGameState                          ║
║  4) pickSmartCol, pickFillCell, hardenFullRows                   ║
╚══════════════════════════════════════════════════════════════════╝
*/

`;

const APP_HEADER = `/*
╔══════════════════════════════════════════════════════════════════╗
║  app.jsx — 학습용 주석판 (원본: 루트/app.jsx)                    ║
╠══════════════════════════════════════════════════════════════════╣
║  【이 파일의 역할】                                               ║
║  React "지휘본부". 화면에 보이는 상태를 들고, 사용자 입력을 받음. ║
║  - transactions = 가계부 거래 목록 (진짜 데이터)                  ║
║  - grid, pool, active, spawnQueue = 게임 화면 상태                ║
║                                                                  ║
║  ★ 버그가 많이 난 이유 ★                                          ║
║  deriveGameState(정답) 와 lockActive/dropMono(연출) 두 갈래가      ║
║  동시에 grid를 바꿔서 숫자와 화면이 어긋남.                       ║
║                                                                  ║
║  【읽는 순서 추천】                                               ║
║  1) useState 목록 (grid, pool, transactions…)                    ║
║  2) handleSheetSubmit — 지출/수입/저축 입력                       ║
║  3) queueSpendBlocks, dropMono, lockActive                       ║
║  4) useEffect (큐, 자동낙하, DROP세션 끝 동기화)                  ║
╚══════════════════════════════════════════════════════════════════╝
*/

`;

/** 함수/섹션 이름 앞에 붙일 한국어 설명 */
const GAME_BLOCKS = {
  "window.GAME = (() => {": `/* 【시작】 즉시실행함수 — 안의 변수를 window.GAME 으로 밖에보냄 */\n`,
  "const COLS = 8;": `  // COLS = 가로 칸 수 (8칸)\n`,
  "const ROWS = 16;": `  // ROWS = 세로 칸 수 (16칸). 0행이 맨 위, 15행이 바닥\n`,
  "const CELL = 26;": `  // 한 칸 픽셀 크기\n`,
  "const TARGET_SPEND_RATIO = 0.8;": `  // 수입의 80% = 지출 "목표" (넘으면 위험)\n`,
  "const SHAPES = {": `  // 블록 모양 — 각 도형마다 회전할 때 좌표 배열 (테트리스 조각)\n`,
  "function monoSubtype": `\n  /* 【낱알 색】 지금은 항상 "red"(빨간 병아리). 예전엔 금액에 따라 흰/빨강 나뉨 */\n  `,
  "function pickFillCell": `\n  /* 【낱알 넣을 칸 찾기】 구멍(hole) 먼저 메우고, 없으면 가장 낮은 곳 */\n  `,
  "function hardenFullRows": `\n  /* 【줄 굳히기】 지출로 가로 한 줄이 꽉 차면 회색 콘크리트로 영구 고정 */\n  `,
  "function makeInitGrid": `\n  /* 【데모용 초기 보드】 예시 블록이 미리 쌓인 그리드 (지금은 거의 안 씀) */\n  `,
  "function makeLandingHeroGrid": `\n  /* 【랜딩 화면용】 첫 화면에 보여줄 멋진 보드 스냅샷 */\n  `,
  "function makeEmptyHomePreviewGrid": `\n  /* 【빈 홈 데모】 거래 없을 때 1회 보여주는 샘플 보드 */\n  `,
  "const TIER_RATIO": `  // 풀에서 블록 나오는 금액 비율 (수입 대비 %)\n`,
  "function getThresholds": `\n  /* 【티어 임계값】 수입 × 2%/4%/18% → cyan/green/orange 금액 */\n  `,
  "function getTargetSpend": `\n  /* 【목표 지출 금액】 수입 × 80% */\n  `,
  "function isOverBudget": `\n  /* 【예산 초과?】 지출 합계가 수입의 80% 넘었는지 */\n  `,
  "function applyPoolDeposit": `\n  /* 【풀에 돈 넣기】 임계 넘으면 블록 1개만 만들고 나머지는 풀에 남김 */\n  `,
  "function makeBaseGrid": `\n  /* 【빈 보드】 16×8 전부 null */\n  `,
  "function simulateLock": `\n  /* 【블록 즉시 착지 시뮬】 위에서 떨어뜨려 그리드에 박음 (derive용) */\n  `,
  "function countOccupiedCells": `\n  /* 【채워진 칸 수】 병아리가 있는 칸 개수 */\n  `,
  "function targetBoardCells": `\n  /* 【보드 목표 칸 수】 (지출+저축)/수입 비율 × 128칸 ★숫자와 보드 높이 연결★ */\n  `,
  "function syncGridToTarget": `\n  /* 【칸 수 맞추기】 derive가 목표 칸까지 부족하면 블록/낱알 추가 */\n  `,
  "function placeSaveVolume": `\n  /* 【저축 쌓기】 노란 O 블록을 시뮬로 바로 착지 */\n  `,
  "function placeMonoOnGrid": `\n  /* 【낱알 1칸】 1×1 지출 셀 하나 끼워 넣기 */\n  `,
  "function computeGoalRow": `\n  /* 【목표 지출선 행】 보드 위에서 80% 지점 = 몇 번째 줄인지 */\n  `,
  "function cellDeltaFromTxChange": `\n  /* 【이번 거래로 늘 칸 수】 derive 기준, 라이브 보드와 무관 (v48) */\n  `,
  "function gridSpendPastGoalRow": `\n  /* 【선 넘었나?】 위험 구역(목표선 위)에 지출 셀이 있는지 */\n  `,
  "function lockBlockOnGrid": `\n  /* 【블록 한 덩어리 착지】 derive 경로에서 블록을 그리드에 바로 박음 */\n  `,
  "function simulateSpendStep": `\n  /*\n   * 【지출 1건 처리 ★핵심★】\n   * 순서: 풀 적립 → (대액이면 red블록) → (풀 임계 블록) → (낱알)\n   * mutateGrid:false 이면 그리드 안 바꾸고 계획만 반환 (app 애니메이션용)\n   */\n  `,
  "function deriveGameState": `\n  /*\n   * 【★★★ 가장 중요 ★★★】\n   * 모든 거래를 처음부터 다시 재생해서\n   * grid, pool, expense, ghostMode 를 한 번에 계산.\n   * "정답 보드"는 여기 결과.\n   */\n  `,
  "function pickSmartCol": `\n  /* 【똑똑한 열 선택】 한쪽으로 쏠리지 않게 가장 평평한 열에 블록 스폰 */\n  `,
  "function sumTxTotals": `\n  /* 【합계】 수입·지출·저축 금액 합 */\n  `,
  "function loadChickPersistState": `\n  /* 【불러오기】 localStorage 에서 거래·즐겨찾기 복원 */\n  `,
  "function saveChickPersistState": `\n  /* 【저장하기】 400ms마다 app.jsx가 호출 */\n  `,
  "function deriveYearPoolBadges": `\n  /* 【연간 트로피】 매달 풀에서 블록 안 나온 달 = 성공 */\n  `,
  "return {": `\n  /* 【보내기】 window.GAME 에서 app.jsx가 꺼내 쓰는 목록 */\n`,
};

const APP_BLOCKS = {
  "const { useState": `// React 훅 — 화면이 바뀔 때 다시 그리게 해 주는 도구들\n`,
  "} = window.GAME;": `// ↑ game-data.jsx 가 만든 window.GAME 에서 필요한 함수만 꺼냄\n`,
  "const AUTO_FALL_MS = 850;": `// 블록이 0.85초마다 한 칸씩 아래로 (자동 낙하)\n`,
  "const INITIAL_TRANSACTIONS = [];": `// 처음엔 거래 없음 (빈 가계부)\n`,
  "function bootAppState": `\n/* 【앱 켤 때】 localStorage 있으면 복원, 없으면 빈 상태 */\n`,
  "function App()": `\n/* 【메인 앱】 전체 화면을 그리는 큰 함수 */\n`,
  "const [grid, setGrid]": `  // grid = 보드에 박힌 병아리들 2차원 배열\n`,
  "const [pool, setPool]": `  // pool = 공중에 떠 있는 자잘한 지출 합계(원)\n`,
  "const [active, setActive]": `  // active = 지금 떨어지고 있는 블록 1개 (없으면 null)\n`,
  "const [spawnQueue, setSpawnQueue]": `  // spawnQueue = 아직 안 나온 지출 블록 대기줄\n`,
  "const [transactions, setTransactions]": `  // ★ transactions = 모든 가계부 기록 (가장 중요한 데이터)\n`,
  "const applyDerivedState": `\n  /* 【정답으로 덮기】 derive 결과로 grid·pool 전부 교체. 편집/삭제/수입 시 */\n`,
  "const recomputeFromTransactions": `\n  /* 【전체 재계산】 거래 바뀌면 deriveGameState 다시 돌림 */\n`,
  "const blockDropSession": `  // DROP 애니 중이면 true — 세션 끝에 derive와 맞춤\n`,
  "const dropMono": `\n  /* 【낱알 즉시 박기】 DROP 없이 1칸씩 바로 grid에 추가 → "막 쌓임" 체감 */\n`,
  "const queueSpendBlocks": `\n  /* 【지출 후 블록 예약】 simulateSpendStep 계획 → 큐에 넣거나 낱알 */\n`,
  "const handleSheetSubmit": `\n  /* 【★ 입력 확인 버튼 ★】 수입/지출/저축 시트에서 확정할 때 */\n`,
  "const lockActive": `\n  /* 【DROP 착지】 떨어지던 블록을 grid에 고정 */\n`,
  "const onRescue": `\n  /* 【저축 보상】 노란 줄만 가득 찬 행 1개 삭제 (1회) */\n`,
  "useEffect(() => {\n    if (active) return;\n    if (spawnQueue.length": `\n  /* 【큐 → 활성】 대기 중인 다음 블록을 active로 꺼냄 */\n  useEffect(() => {\n    if (active) return;\n    if (spawnQueue.length`,
  "// DROP 세션 종료 후 derive": `\n  /* 【세션 끝 동기화】 큐 비면 derive 그리드로 맞춤 (안 맞으면 화면·숫자 어긋남) */\n  // DROP 세션 종료 후 derive`,
  "// ── AUTO FALL": `\n  /* 【자동 낙하】 active 블록을 주기적으로 아래로 (바닥 닿아도 자동 착지는 안 함) */\n  // ── AUTO FALL`,
  "const stackPastLine": `  // 라이브 보드가 목표선 위로 넘었는지\n`,
  "const boardGhostMode": `  // 보드에 그릴 때 기절(흰 병아리) 켤지\n`,
  "ReactDOM.createRoot": `\n/* 【앱 시작】 id="root" div 안에 App 그리기 */\n`,
};

function annotate(src, header, blocks) {
  let out = header + src;
  for (const [needle, comment] of Object.entries(blocks)) {
    out = out.split(needle).join(comment + needle);
  }
  return out;
}

const gameSrc = readFileSync(path.join(ROOT, "game-data.jsx"), "utf8");
const appSrc = readFileSync(path.join(ROOT, "app.jsx"), "utf8");

writeFileSync(
  path.join(OUT, "03-game-data.commented.jsx"),
  annotate(gameSrc, GAME_HEADER, GAME_BLOCKS),
  "utf8"
);
writeFileSync(
  path.join(OUT, "04-app.commented.jsx"),
  annotate(appSrc, APP_HEADER, APP_BLOCKS),
  "utf8"
);

console.log("Wrote study/annotated/03-game-data.commented.jsx");
console.log("Wrote study/annotated/04-app.commented.jsx");
