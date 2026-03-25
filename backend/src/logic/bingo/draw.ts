// backend/src/logic/bingo/draw.ts

import { MIN_BINGO_NUMBER, MAX_BINGO_NUMBER } from "../../constants/bingo.js";

// 既に引いた番号の配列の型
export type DrawState = {
  drawnNumbers: number[];
};

const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const drawNumber = (
  state: DrawState,
): {
  drawnNumber: number | null; // 今回引いた番号
  nextState: DrawState; // 既に引いた番号の配列
} => {
  // まだ引かれていない番号の配列
  const remainingNumbers: number[] = [];

  // 1 ~ 75 の番号を全部なめる
  // その n が既に引かれた番号「でない」ならば
  // remainingNumbers に格納
  for (let n = MIN_BINGO_NUMBER; n <= MAX_BINGO_NUMBER; n++) {
    if (!state.drawnNumbers.includes(n)) {
      remainingNumbers.push(n);
    }
  }

  // もう全ての番号を引いたら drawnNumber を null に
  // ゲームはこれ以上進まないように後で実装を
  if (remainingNumbers.length === 0) {
    return {
      drawnNumber: null,
      nextState: state,
    };
  }

  // 残っている番号の中から一つ数を選ぶ
  const randomIndex = getRandomInt(0, remainingNumbers.length - 1);
  const drawnNumber = remainingNumbers[randomIndex];

  return {
    drawnNumber,
    nextState: {
      drawnNumbers: [...state.drawnNumbers, drawnNumber],
    },
  };
};
