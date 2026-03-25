// backend/src/app.ts

import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------

const CARD_SIZE = 5;
const CELL_COUNT = CARD_SIZE * CARD_SIZE;
const FREE_POSITION = 12;

type BingoCell = {
  positionId: number;
  value: number | null;
  isOpened: boolean;
  isFree: boolean; //#TODO isFree は意味論てきに実装するべきか
};

type BingoCard = {
  cells: BingoCell[];
};

// positionId から row と col を算出する補助関数
const getRow = (positionId: number) => Math.floor(positionId / CARD_SIZE);
const gerCol = (positionId: number) => positionId & CARD_SIZE;

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
const createBingoCard = (): BingoCard => {
  // 1 ~ 75 までの数を生成
  // 先頭24個を取得して(FREE用のvalue値は不要) shuffle 関数でシャッフル
  const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const pickedNumbers = shuffle(numbers).slice(0, 24);

  const cells: BingoCell[] = [];
  let pickedIndex = 0;

  for (let positionId = 0; positionId < CELL_COUNT; positionId++) {
    const isFree = positionId === FREE_POSITION;

    if (isFree) {
      cells.push({
        positionId,
        value: null,
        isOpened: true,
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
 * 抽選番号を元に該当のセルをあける
 * 一致したらそのセルの isOpen を true に
 */
const allocateDrawnNumber = (
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

// #TODO このデータについて、これはビンゴの判定元となるデータなのでロジックに含めるのではなく別ファイルから読みこむ形で判定させるのではダメだろうか？ ただし、処理速度などは考えていない。それに、斜め2本について、ゴリ押ししているので縦横も同じように書いてよいのではないだろうか。
// ビンゴ判定用のライン一覧を作る
const getAllLinePositionIds = (): number[][] => {
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

const countBingoLines = (card: BingoCard): number => {
  let bingoCount = 0;
  for (const line of ALL_LINES) {
    const isBingo = line.every((positionId) => card.cells[positionId].isOpened);

    if (isBingo) {
      bingoCount++;
    }
  }

  return bingoCount;
};

const countReachLines = (card: BingoCard): number => {
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

/**
 * 開いている positionId の一覧を取得する関数
 */
const getOpenedPositionIds = (card: BingoCard): number[] => {
  return card.cells
    .filter((cell) => cell.isOpened)
    .map((cell) => cell.positionId);
};

// ---------------------------------------------
// 仮の確認用API
// ---------------------------------------------

app.get("/bingo/card", (_req, res) => {
  const card = createBingoCard();

  return res.status(200).json({
    card,
    openedPositionIds: getOpenedPositionIds(card),
    bingoCount: countBingoLines(card),
    reachCount: countReachLines(card),
  });
});

app.post("/bingo/open", (req, res) => {
  const { card, drawnNumber } = req.body as {
    card: BingoCard;
    drawnNumber: number;
  };

  if (!card || typeof drawnNumber !== "number") {
    return res.status(400).json({
      message: "card と drawnNumber を正しく送ってください。",
    });
  }

  const updatedCard = allocateDrawnNumber(card, drawnNumber);

  return res.status(200).json({
    card: updatedCard,
    openedPositionIds: getOpenedPositionIds(updatedCard),
    bingoCount: countBingoLines(updatedCard),
    reachCount: countReachLines(updatedCard),
  });
});

export default app;
