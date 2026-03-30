import { countBingoLines } from "../logic/bingo/judge.js";
import { createDefaultEndCondition } from "../logic/session/judge.js";
import type {
  GameSession,
  Player,
  PlayerSessionState,
  Room,
} from "../types/session.js";

export const EVENT_GAUGE_INCREMENT_PER_OPEN = 10;

export const calculateEventGaugeMax = (playerCount: number): number => {
  return playerCount * 30;
};

const createId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createPlayerSessionState = (): PlayerSessionState => {
  return {
    card: null,
    isReadyForStart: false,
    hasActedThisRound: false,
    hasConfirmedEvent: false,
  };
};

const createInitialSession = (players: Player[]): GameSession => {
  return {
    id: createId("session"),
    status: "waiting",
    phase: "waiting_for_ready",
    round: 0,
    currentDrawnNumber: null,
    drawnNumbers: [],
    eventGauge: 0,
    eventGaugeMax: 0,
    eventTriggeredThisRound: false,
    endReason: null,
    winners: [],
    endCondition: createDefaultEndCondition(),
    playerStates: Object.fromEntries(
      players.map((player) => [player.id, createPlayerSessionState()]),
    ),
  };
};

export const createRoom = (hostName: string): { room: Room; host: Player } => {
  const host: Player = {
    id: createId("player"),
    name: hostName,
  };

  const players = [host];

  const room: Room = {
    id: createId("room"),
    hostPlayerId: host.id,
    players,
    currentSession: createInitialSession(players),
  };

  return { room, host };
};

export const createPlayer = (name: string): Player => {
  return {
    id: createId("player"),
    name,
  };
};

export const getPlayer = (room: Room, playerId: string): Player | null => {
  return room.players.find((player) => player.id === playerId) ?? null;
};

export const getPlayerState = (
  session: GameSession,
  playerId: string,
): PlayerSessionState | null => {
  return session.playerStates[playerId] ?? null;
};

export const areAllPlayersReady = (room: Room): boolean => {
  return room.players.every((player) => {
    const state = room.currentSession.playerStates[player.id];
    return state.card !== null && state.isReadyForStart;
  });
};

export const haveAllPlayersActed = (room: Room): boolean => {
  return room.players.every((player) => {
    const state = room.currentSession.playerStates[player.id];
    return state.hasActedThisRound;
  });
};

export const haveAllPlayersConfirmedEvent = (room: Room): boolean => {
  return room.players.every((player) => {
    const state = room.currentSession.playerStates[player.id];
    return state.hasConfirmedEvent;
  });
};

export const collectWinners = (room: Room): string[] => {
  return room.players
    .filter((player) => {
      const state = room.currentSession.playerStates[player.id];
      if (!state.card) return false;

      return (
        countBingoLines(state.card) >=
        room.currentSession.endCondition.bingoCount
      );
    })
    .map((player) => player.id);
};
