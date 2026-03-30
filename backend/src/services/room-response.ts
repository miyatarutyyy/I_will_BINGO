import { countBingoLines, countReachLines } from "../logic/bingo/judge.js";
import { getOpenedPositionIds } from "../logic/bingo/card.js";
import type { Player, PlayerSessionState, Room } from "../types/session.js";

const buildCardSummary = (card: NonNullable<PlayerSessionState["card"]>) => {
  return {
    card,
    openedPositionIds: getOpenedPositionIds(card),
    bingoCount: countBingoLines(card),
    reachCount: countReachLines(card),
  };
};

export const buildPlayerResponse = (room: Room, player: Player) => {
  const playerState = room.currentSession.playerStates[player.id];

  if (!playerState.card) {
    return {
      id: player.id,
      name: player.name,
      isReadyForStart: playerState.isReadyForStart,
      hasActedThisRound: playerState.hasActedThisRound,
      hasSubmittedEventChoice: playerState.hasSubmittedEventChoice,
      card: null,
    };
  }

  return {
    id: player.id,
    name: player.name,
    isReadyForStart: playerState.isReadyForStart,
    hasActedThisRound: playerState.hasActedThisRound,
    hasSubmittedEventChoice: playerState.hasSubmittedEventChoice,
    ...buildCardSummary(playerState.card),
  };
};

export const buildRoomResponse = (room: Room) => {
  return {
    room: {
      id: room.id,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => buildPlayerResponse(room, player)),
      currentSession: room.currentSession,
    },
  };
};
