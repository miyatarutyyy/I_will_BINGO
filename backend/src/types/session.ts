// backend/src/types/session.ts

import type { BingoCard } from "./bingo.ts";

export type SessionStatus = "waiting" | "in_progress" | "finished";

export type SessionEndReason = null | "bingo" | "all_numbers_drawn";

export type SessionEndCondition = {
  bingoCount: number;
  finishWhenAllNumbersDrawn: boolean;
};

export type Player = {
  id: string;
  name: string;
  card: BingoCard | null;
};

export type GameSession = {
  status: SessionStatus;
  round: number;
  drawnNumbers: number[];
  endReason: SessionEndReason;
  winners: string[];
  endCondition: SessionEndCondition;
};

export type GameState = {
  session: GameSession;
  player: Player;
};
