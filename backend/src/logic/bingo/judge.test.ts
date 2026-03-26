// backend/src/logic/bingo/judge.test.ts

import { describe, it, expect } from "vitest";

import type { BingoCard, BingoCell } from "../../types/bingo.js";
import {
  getAllLinePositionIds,
  countBingoLines,
  countReachLines,
} from "./judge.js";

/**
 * 開いている positionId 一覧をもとに BingoCard を作る補助関数
 */
const createMockCard = (openedPositionIds: number[]): BingoCard => {
  const cells: BingoCell[] = [];

  for (let positionId = 0; positionId < 25; positionId++) {
    cells.push({
      positionId,
      value: null,
      isOpened: openedPositionIds.includes(positionId),
      isFree: positionId === 12,
    });
  }

  return { cells };
};

describe("getAllLinePositionIds", () => {
  it("12本のラインを返す", () => {
    const lines = getAllLinePositionIds();

    expect(lines).toHaveLength(12);
  });

  it("各ラインが5マスで構成される", () => {
    const lines = getAllLinePositionIds();

    for (const line of lines) {
      expect(line).toHaveLength(5);
    }
  });

  it("横5本を正しく返す", () => {
    const lines = getAllLinePositionIds();

    expect(lines[0]).toEqual([0, 1, 2, 3, 4]);
    expect(lines[1]).toEqual([5, 6, 7, 8, 9]);
    expect(lines[2]).toEqual([10, 11, 12, 13, 14]);
    expect(lines[3]).toEqual([15, 16, 17, 18, 19]);
    expect(lines[4]).toEqual([20, 21, 22, 23, 24]);
  });

  it("縦5本を正しく返す", () => {
    const lines = getAllLinePositionIds();

    expect(lines[5]).toEqual([0, 5, 10, 15, 20]);
    expect(lines[6]).toEqual([1, 6, 11, 16, 21]);
    expect(lines[7]).toEqual([2, 7, 12, 17, 22]);
    expect(lines[8]).toEqual([3, 8, 13, 18, 23]);
    expect(lines[9]).toEqual([4, 9, 14, 19, 24]);
  });

  it("斜め2本を正しく返す", () => {
    const lines = getAllLinePositionIds();

    expect(lines[10]).toEqual([0, 6, 12, 18, 24]);
    expect(lines[11]).toEqual([4, 8, 12, 16, 20]);
  });
});

describe("countBingoLines", () => {
  it("開いているマスがないなら 0 を返す", () => {
    const card = createMockCard([]);

    expect(countBingoLines(card)).toBe(0);
  });

  it("横1列がすべて開いていれば 1 を返す", () => {
    const card = createMockCard([0, 1, 2, 3, 4]);

    expect(countBingoLines(card)).toBe(1);
  });

  it("縦1列がすべて開いていれば 1 を返す", () => {
    const card = createMockCard([0, 5, 10, 15, 20]);

    expect(countBingoLines(card)).toBe(1);
  });

  it("斜め1列がすべて開いていれば 1 を返す", () => {
    const card = createMockCard([0, 6, 12, 18, 24]);

    expect(countBingoLines(card)).toBe(1);
  });

  it("2本ビンゴしていれば 2 を返す", () => {
    const card = createMockCard([0, 1, 2, 3, 4, 0, 5, 10, 15, 20]);

    expect(countBingoLines(card)).toBe(2);
  });

  it("中央を含む横と縦が同時に成立していれば 2 を返す", () => {
    const card = createMockCard([2, 7, 12, 17, 22, 10, 11, 12, 13, 14]);

    expect(countBingoLines(card)).toBe(2);
  });

  it("4マスだけではビンゴにならない", () => {
    const card = createMockCard([0, 1, 2, 3]);

    expect(countBingoLines(card)).toBe(0);
  });
});

describe("countReachLines", () => {
  it("開いているマスがないなら 0 を返す", () => {
    const card = createMockCard([]);

    expect(countReachLines(card)).toBe(0);
  });

  it("横1列で4マス開いていれば 1 を返す", () => {
    const card = createMockCard([0, 1, 2, 3]);

    expect(countReachLines(card)).toBe(1);
  });

  it("縦1列で4マス開いていれば 1 を返す", () => {
    const card = createMockCard([0, 5, 10, 15]);

    expect(countReachLines(card)).toBe(1);
  });

  it("斜め1列で4マス開いていれば 1 を返す", () => {
    const card = createMockCard([0, 6, 12, 18]);

    expect(countReachLines(card)).toBe(1);
  });

  it("2本リーチしていれば 2 を返す", () => {
    const card = createMockCard([0, 1, 2, 3, 5, 10, 15]);

    expect(countBingoLines(card)).toBe(0);
    expect(countReachLines(card)).toBe(2);
  });

  it("5マス開いているビンゴ列はリーチに含めない", () => {
    const card = createMockCard([0, 1, 2, 3, 4]);

    expect(countBingoLines(card)).toBe(1);
    expect(countReachLines(card)).toBe(0);
  });

  it("ビンゴ1本とリーチ1本が同時にあれば、リーチは1本だけ数える", () => {
    const card = createMockCard([0, 1, 2, 3, 4, 5, 10, 15, 20]);

    expect(countBingoLines(card)).toBe(2);
    expect(countReachLines(card)).toBe(0);
  });
});
