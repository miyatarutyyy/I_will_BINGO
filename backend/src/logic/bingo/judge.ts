// backend/src/logic/bingo/judge.ts

import { CARD_SIZE } from "../../constants/bingo.js";
import type { BingoCard } from "../../types/bingo.js";

// #TODO このデータについて、これはビンゴの判定元となるデータなのでロジックに含めるのではなく別ファイルから読みこむ形で判定させるのではダメだろうか？ ただし、処理速度などは考えていない。それに、斜め2本について、ゴリ押ししているので縦横も同じように書いてよいのではないだろうか。
// ビンゴ判定用のライン一覧を作る
export const getAllLinePositionIds = (): number[][] => {
  const lines: number[][] = [];

  // 横 5 本
  for (let row = 0; row < CARD_SIZE; row++) {
    const line: number[] = [];
    for (let col = 0; col < CARD_SIZE; col++) {
      line.push(row * CARD_SIZE + col);
    }
    lines.push(line);
  }

  // 縦 5 本
  for (let col = 0; col < CARD_SIZE; col++) {
    const line: number[] = [];
    for (let row = 0; row < CARD_SIZE; row++) {
      line.push(row * CARD_SIZE + col);
    }
    lines.push(line);
  }

  // 斜め 2 本
  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);

  return lines;
};

//#TODO 上記の#TODO を参照してくださいまし
const ALL_LINES = getAllLinePositionIds();

export const countBingoLines = (card: BingoCard): number => {
  let bingoCount = 0;
  for (const line of ALL_LINES) {
    const isBingo = line.every((positionId) => card.cells[positionId].isOpened);

    if (isBingo) {
      bingoCount++;
    }
  }

  return bingoCount;
};

export const countReachLines = (card: BingoCard): number => {
  let reachCount = 0;
  for (const line of ALL_LINES) {
    const openedCount = line.filter(
      (positionId) => card.cells[positionId].isOpened,
    ).length;

    // ビンゴ可能性の列にあるセルの isOpen が 4 ならば reachCount をインクリメント
    if (openedCount === CARD_SIZE - 1) {
      reachCount++;
    }
  }

  return reachCount;
};
