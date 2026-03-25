// backend/src/app.ts

import express from "express";
import cors from "cors";

import type { BingoCard } from "./types/bingo.js";
import {
  createBingoCard,
  getOpenedPositionIds,
  openCellByDrawnNumber,
} from "./logic/bingo/card.js";
import { drawNumber, type DrawState } from "./logic/bingo/draw.js";
import { countBingoLines, countReachLines } from "./logic/bingo/judge.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let drawState: DrawState = {
  drawnNumbers: [],
};

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

  const updatedCard = openCellByDrawnNumber(card, drawnNumber);

  return res.status(200).json({
    card: updatedCard,
    openedPositionIds: getOpenedPositionIds(updatedCard),
    bingoCount: countBingoLines(updatedCard),
    reachCount: countReachLines(updatedCard),
  });
});

app.post("/bingo/draw", (_req, res) => {
  const result = drawNumber(drawState);

  if (result.drawnNumber === null) {
    return res.status(400).json({
      message: "すべての番号が抽選済みです。",
      drawnNumbers: drawState.drawnNumbers,
    });
  }

  drawState = result.nextState;

  return res.status(200).json({
    drawnNumber: result.drawnNumber,
    drawnNumbers: drawState.drawnNumbers,
  });
});

export default app;
