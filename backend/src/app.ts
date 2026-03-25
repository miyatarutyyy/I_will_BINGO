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
import type {
  GameSession,
  Player,
  PlayerSessionState,
  Room,
} from "./types/session.js";
import {
  createDefaultEndCondition,
  judgeSessionEnd,
} from "./logic/session/judge.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rooms = new Map<string, Room>();

const createId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const createPlayerSessionState = (): PlayerSessionState => {
  return {
    card: null,
    isReadyForStart: false,
    hasActedThisRound: false,
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
    endReason: null,
    winners: [],
    endCondition: createDefaultEndCondition(),
    playerStates: Object.fromEntries(
      players.map((player) => [player.id, createPlayerSessionState()]),
    ),
  };
};

const createRoom = (hostName: string): { room: Room; host: Player } => {
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

const getRoom = (roomId: string): Room | null => {
  return rooms.get(roomId) ?? null;
};

const getPlayer = (room: Room, playerId: string): Player | null => {
  return room.players.find((player) => player.id === playerId) ?? null;
};

const getPlayerState = (
  session: GameSession,
  playerId: string,
): PlayerSessionState | null => {
  return session.playerStates[playerId] ?? null;
};

const buildCardSummary = (card: NonNullable<PlayerSessionState["card"]>) => {
  return {
    card,
    openedPositionIds: getOpenedPositionIds(card),
    bingoCount: countBingoLines(card),
    reachCount: countReachLines(card),
  };
};

const buildPlayerResponse = (room: Room, player: Player) => {
  const playerState = room.currentSession.playerStates[player.id];

  if (!playerState.card) {
    return {
      id: player.id,
      name: player.name,
      isReadyForStart: playerState.isReadyForStart,
      hasActedThisRound: playerState.hasActedThisRound,
      card: null,
    };
  }

  return {
    id: player.id,
    name: player.name,
    isReadyForStart: playerState.isReadyForStart,
    hasActedThisRound: playerState.hasActedThisRound,
    ...buildCardSummary(playerState.card),
  };
};

const buildRoomResponse = (room: Room) => {
  return {
    room: {
      id: room.id,
      hostPlayerId: room.hostPlayerId,
      players: room.players.map((player) => buildPlayerResponse(room, player)),
      currentSession: room.currentSession,
    },
  };
};

const areAllPlayersReady = (room: Room): boolean => {
  return room.players.every((player) => {
    const state = room.currentSession.playerStates[player.id];
    return state.card !== null && state.isReadyForStart;
  });
};

const haveAllPlayersActed = (room: Room): boolean => {
  return room.players.every((player) => {
    const state = room.currentSession.playerStates[player.id];
    return state.hasActedThisRound;
  });
};

const collectWinners = (room: Room): string[] => {
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

app.post("/rooms", (req, res) => {
  const name =
    typeof req.body?.name === "string" && req.body.name.trim() !== ""
      ? req.body.name.trim()
      : null;

  if (!name) {
    return res.status(400).json({ message: "name は必須です。" });
  }

  const { room, host } = createRoom(name);
  rooms.set(room.id, room);

  return res.status(201).json({
    message: "ルームを作成しました。",
    room: buildRoomResponse(room).room,
    playerId: host.id,
  });
});

app.post("/rooms/:roomId/join", (req, res) => {
  const room = getRoom(req.params.roomId);

  if (!room) {
    return res.status(404).json({ message: "ルームが見つかりません。" });
  }

  if (room.currentSession.status !== "waiting") {
    return res.status(409).json({
      message: "進行中または終了済みのセッションには参加できません。",
    });
  }

  if (room.currentSession.phase !== "waiting_for_ready") {
    return res.status(409).json({
      message: "準備完了の受付が始まった後は新規参加できません。",
    });
  }

  const name =
    typeof req.body?.name === "string" && req.body.name.trim() !== ""
      ? req.body.name.trim()
      : null;

  if (!name) {
    return res.status(400).json({ message: "name は必須です。" });
  }

  const player: Player = {
    id: createId("player"),
    name,
  };

  room.players.push(player);
  room.currentSession.playerStates[player.id] = createPlayerSessionState();

  return res.status(201).json({
    message: "ルームに参加しました。",
    room: buildRoomResponse(room).room,
    playerId: player.id,
  });
});

app.get("/rooms/:roomId", (req, res) => {
  const room = getRoom(req.params.roomId);

  if (!room) {
    return res.status(404).json({ message: "ルームが見つかりません。" });
  }

  return res.status(200).json(buildRoomResponse(room));
});

app.post("/rooms/:roomId/session/setup", (req, res) => {
  const room = getRoom(req.params.roomId);

  if (!room) {
    return res.status(404).json({ message: "ルームが見つかりません。" });
  }

  if (room.currentSession.status !== "waiting") {
    return res.status(409).json({
      message: "このセッションはすでに開始済み、または終了済みです。",
    });
  }

  const playerId = req.body?.playerId;
  const player = getPlayer(room, playerId);

  if (!player) {
    return res.status(404).json({ message: "プレイヤーが見つかりません。" });
  }

  const playerState = getPlayerState(room.currentSession, playerId);

  if (!playerState) {
    return res
      .status(404)
      .json({ message: "プレイヤー状態が見つかりません。" });
  }

  if (playerState.card) {
    return res.status(409).json({
      message: "カードはすでに作成されています。",
      player: buildPlayerResponse(room, player),
    });
  }

  playerState.card = createBingoCard();

  return res.status(200).json({
    message: "カードを作成しました。",
    room: buildRoomResponse(room).room,
    player: buildPlayerResponse(room, player),
  });
});

app.post("/rooms/:roomId/session/ready", (req, res) => {
  const room = getRoom(req.params.roomId);

  if (!room) {
    return res.status(404).json({ message: "ルームが見つかりません。" });
  }

  if (room.currentSession.status !== "waiting") {
    return res.status(409).json({
      message: "開始前のセッションでのみ ready にできます。",
    });
  }

  if (room.currentSession.phase !== "waiting_for_ready") {
    return res.status(409).json({
      message: "現在 ready を受け付ける段階ではありません。",
    });
  }

  const playerId = req.body?.playerId;
  const player = getPlayer(room, playerId);

  if (!player) {
    return res.status(404).json({ message: "プレイヤーが見つかりません。" });
  }

  const playerState = getPlayerState(room.currentSession, playerId);

  if (!playerState || !playerState.card) {
    return res.status(400).json({
      message: "カード作成後に ready を送信してください。",
    });
  }

  if (playerState.isReadyForStart) {
    return res.status(409).json({
      message: "すでに ready 済みです。",
    });
  }

  playerState.card = openFreeCell(playerState.card);
  playerState.isReadyForStart = true;

  if (areAllPlayersReady(room)) {
    room.currentSession.phase = "waiting_for_host_start";
  }

  return res.status(200).json({
    message: "準備完了を受け付けました。",
    room: buildRoomResponse(room).room,
    player: buildPlayerResponse(room, player),
  });
});

app.post("/rooms/:roomId/session/start", (req, res) => {
  const room = getRoom(req.params.roomId);

  if (!room) {
    return res.status(404).json({ message: "ルームが見つかりません。" });
  }

  const playerId = req.body?.playerId;

  if (playerId !== room.hostPlayerId) {
    return res.status(403).json({
      message: "セッション開始はホストのみ可能です。",
    });
  }

  if (room.currentSession.status !== "waiting") {
    return res.status(409).json({
      message: "このセッションはすでに開始済みです。",
    });
  }

  if (room.currentSession.phase !== "waiting_for_host_start") {
    return res.status(409).json({
      message: "全員の準備完了後に開始できます。",
    });
  }

  if (!areAllPlayersReady(room)) {
    return res.status(409).json({
      message: "まだ準備が整っていないプレイヤーがいます。",
    });
  }

  const result = drawNumber({
    drawnNumbers: room.currentSession.drawnNumbers,
  });

  if (result.drawnNumber === null) {
    room.currentSession.status = "finished";
    room.currentSession.phase = "finished";
    room.currentSession.endReason = "all_numbers_drawn";

    return res.status(409).json({
      message: "抽選可能な番号が残っていません。",
      room: buildRoomResponse(room).room,
    });
  }

  room.currentSession.status = "in_progress";
  room.currentSession.phase = "waiting_for_player_actions";
  room.currentSession.round = 1;
  room.currentSession.currentDrawnNumber = result.drawnNumber;
  room.currentSession.drawnNumbers = result.nextState.drawnNumbers;

  room.players.forEach((player) => {
    room.currentSession.playerStates[player.id].hasActedThisRound = false;
  });

  return res.status(200).json({
    message: "セッションを開始しました。",
    drawNumber: result.drawnNumber,
    room: buildRoomResponse(room).room,
  });
});

app.post("/rooms/:roomId/session/act", (req, res) => {
  const room = getRoom(req.params.roomId);

  if (!room) {
    return res.status(404).json({ message: "ルームが見つかりません。" });
  }

  if (room.currentSession.status !== "in_progress") {
    return res.status(409).json({
      message: "セッション進行中ではありません。",
    });
  }

  if (room.currentSession.phase !== "waiting_for_player_actions") {
    return res.status(409).json({
      message: "現在はプレイヤー操作を受け付ける段階ではありません。",
    });
  }

  const playerId = req.body?.playerId;
  const player = getPlayer(room, playerId);

  if (!player) {
    return res.status(404).json({ message: "プレイヤーが見つかりません。" });
  }

  const playerState = getPlayerState(room.currentSession, playerId);

  if (!playerState || !playerState.card) {
    return res.status(400).json({
      message: "カード未作成のプレイヤーです。",
    });
  }

  if (playerState.hasActedThisRound) {
    return res.status(409).json({
      message: "このラウンドはすでに操作済みです。",
    });
  }

  const drawnNumber = room.currentSession.currentDrawnNumber;

  if (drawnNumber === null) {
    return res.status(409).json({
      message: "現在の抽選番号が存在しません。",
    });
  }

  playerState.card = openCellByDrawnNumber(playerState.card, drawnNumber);
  playerState.hasActedThisRound = true;

  if (haveAllPlayersActed(room)) {
    const winners = collectWinners(room);

    room.currentSession.winners = winners;

    const maxBingoCount = room.players.reduce((max, player) => {
      const state = room.currentSession.playerStates[player.id];
      if (!state.card) return max;
      return Math.max(max, countBingoLines(state.card));
    }, 0);

    const endReason = judgeSessionEnd({
      bingoCount: maxBingoCount,
      drawnNumbers: room.currentSession.drawnNumbers,
      endCondition: room.currentSession.endCondition,
    });

    if (endReason) {
      room.currentSession.status = "finished";
      room.currentSession.phase = "finished";
      room.currentSession.endReason = endReason;
    } else {
      room.currentSession.phase = "waiting_for_host_next_round";
    }
  }

  return res.status(200).json({
    message: "このラウンドの操作を受け付けました。",
    room: buildRoomResponse(room).room,
    player: buildPlayerResponse(room, player),
  });
});

app.post("/rooms/:roomId/session/next-round", (req, res) => {
  const room = getRoom(req.params.roomId);

  if (!room) {
    return res.status(404).json({ message: "ルームが見つかりません。" });
  }

  const playerId = req.body?.playerId;

  if (playerId !== room.hostPlayerId) {
    return res.status(403).json({
      message: "次ラウンドへの移行はホストのみ可能です。",
    });
  }

  if (room.currentSession.status !== "in_progress") {
    return res.status(409).json({
      message: "進行中セッションではありません。",
    });
  }

  if (room.currentSession.phase !== "waiting_for_host_next_round") {
    return res.status(409).json({
      message: "全員の操作完了後にのみ次ラウンドへ進めます。",
    });
  }

  if (!haveAllPlayersActed(room)) {
    return res.status(409).json({
      message: "まだ操作を終えていないプレイヤーがいます。",
    });
  }

  const result = drawNumber({
    drawnNumbers: room.currentSession.drawnNumbers,
  });

  if (result.drawnNumber === null) {
    room.currentSession.status = "finished";
    room.currentSession.phase = "finished";
    room.currentSession.endReason = "all_numbers_drawn";

    return res.status(200).json({
      message: "すべての番号が抽選されたためセッションを終了しました。",
      room: buildRoomResponse(room).room,
    });
  }

  room.currentSession.round += 1;
  room.currentSession.currentDrawnNumber = result.drawnNumber;
  room.currentSession.drawnNumbers = result.nextState.drawnNumbers;
  room.currentSession.phase = "waiting_for_player_actions";

  room.players.forEach((player) => {
    room.currentSession.playerStates[player.id].hasActedThisRound = false;
  });

  return res.status(200).json({
    message: "次ラウンドへ移行しました。",
    drawNumber: result.drawnNumber,
    room: buildRoomResponse(room).room,
  });
});

export default app;
