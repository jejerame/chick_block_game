/**
 * 보드 부피·저축률 회귀 테스트 — npm run test
 * deriveGameState 단일 경로가 깨지면 CI/로컬에서 즉시 잡을 수 있게.
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = readFileSync(path.join(ROOT, "dist/game-data.js"), "utf8");
const g = { window: null };
g.window = g;
new Function("window", code)(g.window);
const GAME = g.window.GAME;

const {
  deriveGameState,
  sumTxTotals,
  countOccupiedCells,
  targetBoardCells,
  ROWS,
  COLS,
} = GAME;

const BOARD = ROWS * COLS;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mkTx(type, amount, id, createdAt) {
  return {
    id,
    type,
    amount,
    date: "2026-05-01",
    categoryTop: type === "income" ? "수입" : "생활",
    categorySub: type === "income" ? "급여" : type === "save" ? "적금" : "외식",
    createdAt,
  };
}

// 1) 지출+저축 = 수입 → 보드 100%
{
  const txs = [
    mkTx("income", 2_500_000, "i", 0),
    mkTx("save", 1_000_000, "s", 2),
    mkTx("spend", 1_500_000, "e", 3),
  ];
  const d = deriveGameState(txs);
  const cells = countOccupiedCells(d.grid);
  assert(cells === BOARD, `100% fill: expected ${BOARD}, got ${cells}`);
}

// 2) 수입 거래가 지출 뒤에 있어도 동일 부피 (createdAt 순서 버그 방지)
{
  const txs = [
    mkTx("spend", 500_000, "e", 2),
    mkTx("income", 2_500_000, "i", 5),
  ];
  const d = deriveGameState(txs);
  const target = targetBoardCells(2_500_000, 500_000, 0);
  const cells = countOccupiedCells(d.grid);
  assert(cells >= target - 2 && cells <= target + 4, `order-invariant: target ${target}, got ${cells}`);
  assert(target === Math.round((500_000 / 2_500_000) * BOARD), "target ratio 20%");
}

// 3) 50만 지출 단건 — red 다블록 (약 26칸)
{
  const txs = [mkTx("income", 2_500_000, "i", 0), mkTx("spend", 500_000, "e", 1)];
  const d = deriveGameState(txs);
  const cells = countOccupiedCells(d.grid);
  assert(cells >= 20, `500k spend should fill ~26 cells, got ${cells}`);
}

// 4) 저축률 40% — sumTxTotals
{
  const txs = [mkTx("income", 2_500_000, "i", 0), mkTx("save", 1_000_000, "s", 1)];
  const t = sumTxTotals(txs);
  assert(t.income === 2_500_000 && t.savings === 1_000_000, "totals");
  const pct = Math.round((t.savings / t.income) * 100);
  assert(pct === 40, `save pct expected 40, got ${pct}`);
  const eggs = Math.round((t.savings / t.income) * 18);
  assert(eggs === 7, `eggs expected 7, got ${eggs}`);
}

console.log("OK — all volume regression tests passed");
