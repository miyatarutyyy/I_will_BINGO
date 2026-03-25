// backend/src/app.ts

import express from "express";
import cors from "cors";

import {
  createBingoCard,
  getOpenedPositionIds,
  openFreeCell,
  openCellByDrawnNumber,
} from "./logic/bingo/card.js";
import { drawNumber } from "./logic/bingo/draw.js";
import { countBingoLines, countReachLines } from "./logic/bingo/judge.js";
import type { GameState, GameSession, Player } from "./types/session.js";
import {
  createDefaultEndCondition,
  judgeSessionEnd,
} from "./logic/session/judge.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const createInitialSession = (): GameSession => {
  return {
    status: "waiting",
    round: 0,
    drawnNumbers: [],
    endReason: null,
    winners: [],
    endCondition: createDefaultEndCondition(),
  };
};

const createInitialPlayer = (): Player => {
  return {
    id: "player-1",
    name: "Player 1",
    card: null,
  };
};

let gameState: GameState = {
  session: createInitialSession(),
  player: createInitialPlayer(),
};

const buildCardSummary = (card: NonNullable<Player["card"]>) => {
  return {
    card,
    openedPositionIds: getOpenedPositionIds(card),
    bingoCount: countBingoLines(card),
    reachCount: countReachLines(card),
  };
};

/*
 * POST /session/setup
 * カードの生成
 * セッションはまだはじめない
 */
app.post("/session/setup", (_req, res) => {
  if (gameState.session.status !== "waiting") {
    return res.status(409).json({
      message: "このセッションはすでに開始済み、または終了済みです。",
      session: gameState.session,
      player: gameState.player,
    });
  }

  if (gameState.player.card) {
    return res.status(409).json({
      message: "カードはすでに作成されています。",
      session: gameState.session,
      player: {
        id: gameState.player.id,
        name: gameState.player.name,
        ...buildCardSummary(gameState.player.card),
      },
    });
  }

  const newCard = createBingoCard();

  gameState = {
    ...gameState,
    player: {
      ...gameState.player,
      card: newCard,
    },
  };

  return res.status(200).json({
    message: "カードを作成しました。",
    session: gameState.session,
    player: {
      id: gameState.player.id,
      name: gameState.player.name,
      ...buildCardSummary(newCard),
    },
  });
});

/*
 * POST /session/start
 * クライアントが FREEセルを開くアクションをする
 * ゲームのセッションを開始する
 */
app.post("/session/start", (_req, res) => {
  if (gameState.session.status !== "waiting") {
    return res.status(409).json({
      message: "このセッションはすでに開始済みです。",
      session: gameState.session,
      player: gameState.player,
    });
  }

  if (!gameState.player.card) {
    return res.status(400).json({
      message: "カードが未作成です。",
      session: gameState.session,
      player: gameState.player,
    });
  }

  const newCard = openFreeCell(gameState.player.card);

  gameState = {
    session: {
      ...gameState.session,
      status: "in_progress",
      round: 1,
    },
    player: {
      ...gameState.player,
      card: newCard,
    },
  };

  return res.status(200).json({
    message: "セッションを開始しました。",
    session: gameState.session,
    player: {
      id: gameState.player.id,
      name: gameState.player.name,
      ...buildCardSummary(newCard),
    },
  });
});

/*
 * POST /session/draw
 */
app.post("/session/draw", (_req, res) => {
  if (gameState.session.status === "finished") {
    return res.status(409).json({
      message: "セッションはすでに終了しています。",
      session: gameState.session,
      player: gameState.player,
    });
  }

  if (gameState.session.status !== "in_progress") {
    return res.status(409).json({
      message: "セッションが開始されていません。",
      session: gameState.session,
      player: gameState.player,
    });
  }

  if (!gameState.player.card) {
    return res.status(400).json({
      message: "プレイヤーのカードが存在しません。",
      session: gameState.session,
      player: gameState.player,
    });
  }

  const currentCard = gameState.player.card;

  const result = drawNumber({
    drawnNumbers: gameState.session.drawnNumbers,
  });

  if (result.drawnNumber === null) {
    gameState = {
      ...gameState,
      session: {
        ...gameState.session,
        status: "finished",
        endReason: "all_numbers_drawn",
      },
    };

    return res.status(409).json({
      message: "すべての番号が抽選済みです。",
      drawNumber: null,
      session: gameState.session,
      player: {
        id: gameState.player.id,
        name: gameState.player.name,
        ...buildCardSummary(currentCard),
      },
    });
  }

  const updatedCard = openCellByDrawnNumber(currentCard, result.drawnNumber);
  const bingoCount = countBingoLines(updatedCard);

  const nextSession: GameSession = {
    ...gameState.session,
    round: gameState.session.round + 1,
    drawnNumbers: result.nextState.drawnNumbers,
    winners:
      bingoCount >= gameState.session.endCondition.bingoCount
        ? [gameState.player.id]
        : [],
  };

  const endReason = judgeSessionEnd({
    bingoCount,
    drawnNumbers: nextSession.drawnNumbers,
    endCondition: nextSession.endCondition,
  });

  gameState = {
    session: {
      ...nextSession,
      status: endReason ? "finished" : "in_progress",
      endReason,
    },
    player: {
      ...gameState.player,
      card: updatedCard,
    },
  };

  return res.status(200).json({
    message:
      endReason === "bingo"
        ? "ビンゴが成立したためセッションを終了しました。"
        : endReason === "all_numbers_drawn"
          ? "すべての番号が抽選されたためセッションを終了しました。"
          : "抽選しました。",
    drawNumber: result.drawnNumber,
    session: gameState.session,
    player: {
      id: gameState.player.id,
      name: gameState.player.name,
      ...buildCardSummary(updatedCard),
    },
  });
});

/*
 * GET /session
 */
app.get("/session", (_req, res) => {
  if (!gameState.player.card) {
    return res.status(200).json({
      session: gameState.session,
      player: gameState.player,
    });
  }

  return res.status(200).json({
    session: gameState.session,
    player: {
      id: gameState.player.id,
      name: gameState.player.name,
      ...buildCardSummary(gameState.player.card),
    },
  });
});

export default app;
