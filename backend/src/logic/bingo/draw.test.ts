// backend/src/logic/bingo/draw.test.ts

import { describe, it, expect, vi, afterEach } from "vitest";

import { MIN_BINGO_NUMBER, MAX_BINGO_NUMBER } from "../../constants/bingo.js";
import { drawNumber, type DrawState } from "./draw.js";

// vi とは Vitest の便利機能をまとめて使うための入口
// mock とはテストのために意図的に振る舞いを固定した代用品
// vi.spyOn は「ある対象を監視」する
// afterEach は 各テストケースのあとに毎回実行される処理

/*
 * spyOn(...) や mock によって差し替えたものを元に戻す処理
 * mock で差し替えた値がそのあとのテストに影響を与えないように
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe("drawNumber", () => {
  it("まだ引かれていない番号の中から1つ引く", () => {
    const state: DrawState = {
      drawnNumbers: [],
    };

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = drawNumber(state);

    expect(result.drawnNumber).toBe(MIN_BINGO_NUMBER);
    expect(result.nextState.drawnNumbers).toEqual([MIN_BINGO_NUMBER]);
  });

  it("すでに引かれた番号は再び引かない", () => {
    const state: DrawState = {
      drawnNumbers: [1, 2, 3],
    };

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = drawNumber(state);

    expect(result.drawnNumber).toBe(4);
    expect(result.nextState.drawnNumbers).toEqual([1, 2, 3, 4]);
  });

  it("引いた番号を nextState.drawnNumbers の末尾に追加する", () => {
    const state: DrawState = {
      drawnNumbers: [1, 2, 3],
    };

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = drawNumber(state);

    expect(result.nextState.drawnNumbers).toEqual([1, 2, 3, 4]);
  });

  it("元の state を破壊しない", () => {
    const state: DrawState = {
      drawnNumbers: [1, 2, 3],
    };

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = drawNumber(state);

    expect(state.drawnNumbers).toEqual([1, 2, 3]);
    expect(result.nextState).not.toBe(state);
    expect(result.nextState.drawnNumbers).not.toBe(state.drawnNumbers);
  });

  it("Math.random がほぼ 1 のとき、残り番号の最後を引く", () => {
    const state: DrawState = {
      drawnNumbers: [],
    };

    vi.spyOn(Math, "random").mockReturnValue(0.999999);

    const result = drawNumber(state);

    expect(result.drawnNumber).toBe(MAX_BINGO_NUMBER);
    expect(result.nextState.drawnNumbers).toEqual([MAX_BINGO_NUMBER]);
  });

  it("すべての番号が引かれていたら drawnNumber は null を返す", () => {
    const allDrawnNumbers = Array.from(
      { length: MAX_BINGO_NUMBER - MIN_BINGO_NUMBER + 1 },
      (_, i) => i + MIN_BINGO_NUMBER,
    );

    const state: DrawState = {
      drawnNumbers: allDrawnNumbers,
    };

    const result = drawNumber(state);

    expect(result.drawnNumber).toBeNull();
  });

  it("すべての番号が引かれていたら nextState は元の state をそのまま返す", () => {
    const allDrawnNumbers = Array.from(
      { length: MAX_BINGO_NUMBER - MIN_BINGO_NUMBER + 1 },
      (_, i) => i + MIN_BINGO_NUMBER,
    );

    const state: DrawState = {
      drawnNumbers: allDrawnNumbers,
    };

    const result = drawNumber(state);

    expect(result.nextState).toBe(state);
    expect(result.nextState.drawnNumbers).toEqual(allDrawnNumbers);
  });
});
