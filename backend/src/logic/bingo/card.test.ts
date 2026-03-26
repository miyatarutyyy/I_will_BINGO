// backend/src/logit/bingo/card.test.ts

import { describe, it, expect } from "vitest";

import { FREE_POSITION, CELL_COUNT } from "../../constants/bingo.js";
import type { BingoCard } from "../../types/bingo.js";
import {
  createBingoCard,
  openFreeCell,
  openCellByDrawnNumber,
  getOpenedPositionIds,
} from "./card.js";

describe("createBingoCard", () => {
  it("25マスのカードを作る", () => {
    const card = createBingoCard();

    expect(card.cells).toHaveLength(CELL_COUNT);
  });

  it("FREEマス以外の24マスには数値が入っている", () => {
    const card = createBingoCard();

    const freeCells = card.cells.filter((cell) => cell.isFree);

    expect(freeCells).toHaveLength(1);
    expect(freeCells[0].positionId).toBe(FREE_POSITION);
    expect(freeCells[0].value).toBeNull();
  });

  it("FREEマス以外は最初は閉じている", () => {
    const card = createBingoCard();

    const normalCells = card.cells.filter((cell) => !cell.isFree);

    for (const cell of normalCells) {
      expect(cell.isOpened).toBe(false);
    }
  });

  it("FREEマスも最初は閉じている", () => {
    const card = createBingoCard();
    const freeCell = card.cells.find((cell) => cell.isFree);

    expect(freeCell).toBeDefined();
    expect(freeCell?.isOpened).toBe(false);
  });

  it("FREE以外の数字は重複しない", () => {
    const card = createBingoCard();

    const values = card.cells
      .filter((cell) => !cell.isFree)
      .map((cell) => cell.value);

    const uniqueValues = new Set(values);

    expect(uniqueValues.size).toBe(24);
  });
});

describe("openFreeCell", () => {
  it("FREEマスだけを開く", () => {
    const card = createBingoCard();

    const updatedCard = openFreeCell(card);

    for (const cell of updatedCard.cells) {
      if (cell.isFree) {
        expect(cell.isOpened).toBe(true);
      } else {
        expect(cell.isOpened).toBe(false);
      }
    }
  });

  it("元のカードを破壊せず、新しいカードを返す", () => {
    const card = createBingoCard();

    const updatedCard = openFreeCell(card);

    expect(updatedCard).not.toBe(card);
    expect(updatedCard.cells).not.toBe(card.cells);
  });
});

describe("openCellByDrawnNumber", () => {
  const sampleCard: BingoCard = {
    cells: [
      { positionId: 0, value: 10, isOpened: false, isFree: false },
      { positionId: 1, value: 20, isOpened: false, isFree: false },
      { positionId: 2, value: 30, isOpened: false, isFree: false },
      { positionId: 3, value: 40, isOpened: false, isFree: false },
      { positionId: 4, value: 50, isOpened: false, isFree: false },
      { positionId: 5, value: 60, isOpened: false, isFree: false },
      { positionId: 6, value: 70, isOpened: false, isFree: false },
      { positionId: 7, value: 71, isOpened: false, isFree: false },
      { positionId: 8, value: 72, isOpened: false, isFree: false },
      { positionId: 9, value: 73, isOpened: false, isFree: false },
      { positionId: 10, value: 74, isOpened: false, isFree: false },
      { positionId: 11, value: 75, isOpened: false, isFree: false },
      { positionId: 12, value: null, isOpened: false, isFree: true },
      { positionId: 13, value: 1, isOpened: false, isFree: false },
      { positionId: 14, value: 2, isOpened: false, isFree: false },
      { positionId: 15, value: 3, isOpened: false, isFree: false },
      { positionId: 16, value: 4, isOpened: false, isFree: false },
      { positionId: 17, value: 5, isOpened: false, isFree: false },
      { positionId: 18, value: 6, isOpened: false, isFree: false },
      { positionId: 19, value: 7, isOpened: false, isFree: false },
      { positionId: 20, value: 8, isOpened: false, isFree: false },
      { positionId: 21, value: 9, isOpened: false, isFree: false },
      { positionId: 22, value: 11, isOpened: false, isFree: false },
      { positionId: 23, value: 12, isOpened: false, isFree: false },
      { positionId: 24, value: 13, isOpened: false, isFree: false },
    ],
  };

  it("引かれた番号と一致するセルを開く", () => {
    const updatedCard = openCellByDrawnNumber(sampleCard, 30);

    const openedCell = updatedCard.cells.find((cell) => cell.positionId === 2);
    expect(openedCell?.isOpened).toBe(true);
  });

  it("一致しないセルは開かない", () => {
    const updatedCard = openCellByDrawnNumber(sampleCard, 30);

    const unopenedCell = updatedCard.cells.find(
      (cell) => cell.positionId === 1,
    );
    expect(unopenedCell?.isOpened).toBe(false);
  });

  it("FREEマスは引数の番号に関係なくそのまま", () => {
    const updatedCard = openCellByDrawnNumber(sampleCard, 30);

    const freeCell = updatedCard.cells.find((cell) => cell.isFree);
    expect(freeCell?.isOpened).toBe(false);
  });

  it("一致する番号がない場合は何も開かない", () => {
    const updatedCard = openCellByDrawnNumber(sampleCard, 999);

    const openedCells = updatedCard.cells.filter((cell) => cell.isOpened);
    expect(openedCells).toHaveLength(0);
  });
});

describe("getOpenedPositionIds", () => {
  it("開いているセルのpositionId一覧を返す", () => {
    const card: BingoCard = {
      cells: [
        { positionId: 0, value: 10, isOpened: true, isFree: false },
        { positionId: 1, value: 20, isOpened: false, isFree: false },
        { positionId: 2, value: 30, isOpened: true, isFree: false },
        { positionId: 3, value: 40, isOpened: false, isFree: false },
        { positionId: 4, value: 50, isOpened: false, isFree: false },
        { positionId: 5, value: 60, isOpened: false, isFree: false },
        { positionId: 6, value: 70, isOpened: false, isFree: false },
        { positionId: 7, value: 71, isOpened: false, isFree: false },
        { positionId: 8, value: 72, isOpened: false, isFree: false },
        { positionId: 9, value: 73, isOpened: false, isFree: false },
        { positionId: 10, value: 74, isOpened: false, isFree: false },
        { positionId: 11, value: 75, isOpened: false, isFree: false },
        { positionId: 12, value: null, isOpened: true, isFree: true },
        { positionId: 13, value: 1, isOpened: false, isFree: false },
        { positionId: 14, value: 2, isOpened: false, isFree: false },
        { positionId: 15, value: 3, isOpened: false, isFree: false },
        { positionId: 16, value: 4, isOpened: false, isFree: false },
        { positionId: 17, value: 5, isOpened: false, isFree: false },
        { positionId: 18, value: 6, isOpened: false, isFree: false },
        { positionId: 19, value: 7, isOpened: false, isFree: false },
        { positionId: 20, value: 8, isOpened: false, isFree: false },
        { positionId: 21, value: 9, isOpened: false, isFree: false },
        { positionId: 22, value: 11, isOpened: false, isFree: false },
        { positionId: 23, value: 12, isOpened: false, isFree: false },
        { positionId: 24, value: 13, isOpened: false, isFree: false },
      ],
    };

    expect(getOpenedPositionIds(card)).toEqual([0, 2, 12]);
  });
});
