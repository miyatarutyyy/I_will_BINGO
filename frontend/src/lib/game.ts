import type {
  BingoCard,
  Room,
  RoundPhase,
  Screen,
  SessionEndReason,
} from "../types/game";

const CARD_SIZE = 5;

const ALL_LINES = (() => {
  const lines: number[][] = [];

  for (let row = 0; row < CARD_SIZE; row += 1) {
    const line: number[] = [];
    for (let col = 0; col < CARD_SIZE; col += 1) {
      line.push(row * CARD_SIZE + col);
    }
    lines.push(line);
  }

  for (let col = 0; col < CARD_SIZE; col += 1) {
    const line: number[] = [];
    for (let row = 0; row < CARD_SIZE; row += 1) {
      line.push(row * CARD_SIZE + col);
    }
    lines.push(line);
  }

  lines.push([0, 6, 12, 18, 24]);
  lines.push([4, 8, 12, 16, 20]);

  return lines;
})();

export const trimText = (value: string) => value.trim();

export const getApiMessage = (payload: unknown, fallback: string) => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return fallback;
};

export const getScreenFromRoom = (room: Room | null): Screen => {
  if (!room) return "title";
  if (room.currentSession.status === "finished") return "result";
  if (room.currentSession.status === "in_progress") return "game";
  return "room";
};

export const getPlayerById = (room: Room | null, playerId: string) => {
  if (!room || playerId === "") return null;
  return room.players.find((player) => player.id === playerId) ?? null;
};

export const getHighlightedLines = (card: BingoCard | null) => {
  if (!card) return [];

  return ALL_LINES.filter((line) =>
    line.every((positionId) => card.cells[positionId]?.isOpened),
  );
};

export const getHighlightedCellSet = (card: BingoCard | null) => {
  const positions = new Set<number>();

  for (const line of getHighlightedLines(card)) {
    for (const positionId of line) {
      positions.add(positionId);
    }
  }

  return positions;
};

export const getPhaseLabel = (phase: RoundPhase) => {
  switch (phase) {
    case "waiting_for_ready":
      return "準備中";
    case "waiting_for_host_start":
      return "開始待ち";
    case "waiting_for_event_choices":
      return "イベント待ち";
    case "waiting_for_player_actions":
      return "アクション待ち";
    case "waiting_for_host_next_round":
      return "次ラウンド待ち";
    case "finished":
      return "終了";
  }
};

export const getEndReasonLabel = (reason: SessionEndReason) => {
  if (reason === "bingo") return "誰かがビンゴしました";
  if (reason === "all_numbers_drawn") return "全ての番号が抽選されました";
  return "ゲーム終了";
};
