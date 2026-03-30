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
};

export type PlayerSessionState = {
  card: BingoCard | null;
  isReadyForStart: boolean;
  hasActedThisRound: boolean;
  hasSubmittedEventChoice: boolean;
};

export type EventDirection = "clockwise" | "counterclockwise";

export type EventChoiceOption = {
  direction: EventDirection;
  step: number;
  label: string;
};

export type EventSegment = {
  order: number;
  assignedPlayerId: string;
  from: number;
  to: number;
  clockwiseStep: number;
  counterClockwiseStep: number;
  selectedDirection: EventDirection | null;
  selectedStep: number | null;
};

export type ResolvedEventSegment = {
  order: number;
  playerId: string;
  from: number;
  to: number;
  direction: EventDirection;
  selectedStep: number;
};

export type EventState = {
  startNumber: number;
  goalNumber: number;
  relayNumbers: number[];
  segments: EventSegment[];
  resolvedTimeline: ResolvedEventSegment[];
};

export type RoundPhase =
  | "waiting_for_ready"
  | "waiting_for_host_start"
  | "waiting_for_event_choices"
  | "waiting_for_player_actions"
  | "waiting_for_host_next_round"
  | "finished";

export type GameSession = {
  id: string;
  status: "waiting" | "in_progress" | "finished";
  phase: RoundPhase;
  round: number;
  currentDrawnNumber: number | null;
  drawnNumbers: number[];
  eventGauge: number;
  eventGaugeMax: number;
  currentEvent: EventState | null;
  endReason: SessionEndReason;
  winners: string[];
  endCondition: SessionEndCondition;
  playerStates: Record<string, PlayerSessionState>;
};

export type Room = {
  id: string;
  hostPlayerId: string;
  players: Player[];
  currentSession: GameSession;
};
