// backend/src/logic/bingo/card.ts

import {
  CELL_COUNT,
  FREE_POSITION,
  MAX_BINGO_NUMBER,
} from "../../constants/bingo.js";
import type { BingoCard, BingoCell } from "../../types/bingo.js";

/**
 * 受け取った配列をシャッフルする関数
 * 配列の後ろから前に向かって1つずつ確認するループ
 */
const shuffle = <T>(array: T[]): T[] => {
  const copied = [...array];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
};

/**
 * 1~75 のなかから 24 個の数字を選びとってカードを作る関数
 */
export const createBingoCard = (): BingoCard => {
  // 1 ~ 75 までの数を生成
  // 先頭24個を取得して(FREE用のvalue値は不要) shuffle 関数でシャッフル
  const numbers = Array.from({ length: MAX_BINGO_NUMBER }, (_, i) => i + 1);
  const pickedNumbers = shuffle(numbers).slice(0, 24);

  const cells: BingoCell[] = [];
  let pickedIndex = 0;

  for (let positionId = 0; positionId < CELL_COUNT; positionId++) {
    const isFree = positionId === FREE_POSITION;

    if (isFree) {
      cells.push({
        positionId,
        value: null,
        isOpened: false,
        isFree: true,
      });
    } else {
      cells.push({
        positionId,
        value: pickedNumbers[pickedIndex],
        isOpened: false,
        isFree: false,
      });

      pickedIndex++;
    }
  }

  // BingoCard の cell プロパティを返却
  return { cells };
};

/*
 *FREE を開く専用の関数
 */
export const openFreeCell = (card: BingoCard): BingoCard => {
  const newCells = card.cells.map((cell) => {
    if (!cell.isFree) return cell;
    return { ...cell, isOpened: true };
  });

  return { cells: newCells };
};

/*
 * 抽選された番号のセルを開く関数
 */
export const openCellByDrawnNumber = (
  card: BingoCard,
  drawnNumber: number,
): BingoCard => {
  const newCells = card.cells.map((cell) => {
    if (cell.isFree) return cell;

    if (cell.value === drawnNumber) {
      return {
        ...cell,
        isOpened: true,
      };
    }

    return cell;
  });

  return { cells: newCells };
};

//#TODO これ必要か？
/**
 * 開いている positionId の一覧を取得する関数
 */
export const getOpenedPositionIds = (card: BingoCard): number[] => {
  return card.cells
    .filter((cell) => cell.isOpened)
    .map((cell) => cell.positionId);
};
