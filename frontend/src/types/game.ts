export type BingoCell = {
  positionId: number;
  value: number | null;
  isOpened: boolean;
  isFree: boolean;
};

export type BingoCard = {
  cells: BingoCell[];
};

export type SessionStatus = "waiting" | "in_progress" | "finished";
export type SessionEndReason = null | "bingo" | "all_numbers_drawn";
export type RoundPhase =
  | "waiting_for_ready"
  | "waiting_for_host_start"
  | "waiting_for_event_resolution"
  | "waiting_for_player_actions"
  | "waiting_for_host_next_round"
  | "finished";

export type SessionEndCondition = {
  bingoCount: number;
  finishWhenAllNumbersDrawn: boolean;
};

export type PlayerSummary = {
  id: string;
  name: string;
  isReadyForStart: boolean;
  hasActedThisRound: boolean;
  hasConfirmedEvent: boolean;
  card: BingoCard | null;
  openedPositionIds?: number[];
  bingoCount?: number;
  reachCount?: number;
};

export type GameSession = {
  id: string;
  status: SessionStatus;
  phase: RoundPhase;
  round: number;
  currentDrawnNumber: number | null;
  drawnNumbers: number[];
  eventGauge: number;
  eventGaugeMax: number;
  eventTriggeredThisRound: boolean;
  endReason: SessionEndReason;
  winners: string[];
  endCondition: SessionEndCondition;
  playerStates: Record<
    string,
    {
      card: BingoCard | null;
      isReadyForStart: boolean;
      hasActedThisRound: boolean;
      hasConfirmedEvent: boolean;
    }
  >;
};

export type Room = {
  id: string;
  hostPlayerId: string;
  players: PlayerSummary[];
  currentSession: GameSession;
};

export type ApiResponse = {
  message?: string;
  playerId?: string;
  room?: Room;
  player?: PlayerSummary;
  drawNumber?: number | null;
};

export type Screen = "title" | "room" | "game" | "result";
export type NoticeTone = "neutral" | "error" | "success";
export type TitleModal = "closed" | "create" | "join";

export type PendingRoomDraft = {
  room: Room;
  playerId: string;
};
