import express from "express";
import type { Response } from "express";

import {
  createBingoCard,
  openFreeCell,
  openCellByDrawnNumber,
} from "../logic/bingo/card.js";
import { drawNumber } from "../logic/bingo/draw.js";
import { countBingoLines } from "../logic/bingo/judge.js";
import { judgeSessionEnd } from "../logic/session/judge.js";
import {
  areAllPlayersReady,
  calculateEventGaugeMax,
  collectWinners,
  createPlayer,
  createPlayerSessionState,
  EVENT_GAUGE_INCREMENT_PER_OPEN,
  createRoom,
  getPlayer,
  getPlayerState,
  haveAllPlayersSubmittedEventChoice,
  haveAllPlayersActed,
} from "../services/room-state.js";
import {
  buildEventChoiceOptions,
  buildResolvedTimeline,
  createEventState,
  getPlayerEventSegment,
  resolveEventSegmentChoice,
} from "../services/session-event.js";
import {
  buildPlayerResponse,
  buildRoomResponse,
} from "../services/room-response.js";
import {
  addRoomSubscriber,
  broadcastRoom,
  closeRoom,
  deleteRoom,
  getRoom,
  removeRoomSubscriber,
  saveRoom,
  sendSseEvent,
} from "../store/room-store.js";

export const roomsRouter = express.Router();

const parseName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const respondRoomNotFound = (res: Response) => {
  return res.status(404).json({ message: "ルームが見つかりません。" });
};

const getRoomOr404 = (roomId: string, res: Response) => {
  const room = getRoom(roomId);

  if (!room) {
    respondRoomNotFound(res);
    return null;
  }

  return room;
};

const parseEventDirection = (value: unknown) => {
  return value === "clockwise" || value === "counterclockwise" ? value : null;
};

const prepareNextRound = (room: NonNullable<ReturnType<typeof getRoom>>) => {
  const result = drawNumber({
    drawnNumbers: room.currentSession.drawnNumbers,
  });

  if (result.drawnNumber === null) {
    room.currentSession.status = "finished";
    room.currentSession.phase = "finished";
    room.currentSession.endReason = "all_numbers_drawn";

    return { drawnNumber: null as number | null };
  }

  room.currentSession.round += 1;

  const shouldTriggerEvent =
    room.currentSession.eventGaugeMax > 0 &&
    room.currentSession.eventGauge >= room.currentSession.eventGaugeMax;

  room.currentSession.phase = shouldTriggerEvent
    ? "waiting_for_event_choices"
    : "waiting_for_player_actions";
  room.currentSession.currentDrawnNumber = result.drawnNumber;
  room.currentSession.currentEvent = shouldTriggerEvent
    ? createEventState({
        playerIds: room.players.map((player) => player.id),
        decidedNumbers: room.currentSession.drawnNumbers,
        startNumber: result.drawnNumber,
      })
    : null;

  if (!shouldTriggerEvent) {
    room.currentSession.drawnNumbers = result.nextState.drawnNumbers;
  }

  room.players.forEach((player) => {
    room.currentSession.playerStates[player.id].hasActedThisRound = false;
    room.currentSession.playerStates[player.id].hasSubmittedEventChoice = false;
  });

  return { drawnNumber: result.drawnNumber };
};

roomsRouter.post("/rooms", (req, res) => {
  const name = parseName(req.body?.name);

  if (!name) {
    return res.status(400).json({ message: "name は必須です。" });
  }

  const { room, host } = createRoom(name);
  saveRoom(room);
  broadcastRoom(room);

  return res.status(201).json({
    message: "ルームを作成しました。",
    room: buildRoomResponse(room).room,
    playerId: host.id,
  });
});

roomsRouter.post("/rooms/:roomId/join", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

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

  const name = parseName(req.body?.name);

  if (!name) {
    return res.status(400).json({ message: "name は必須です。" });
  }

  const player = createPlayer(name);

  room.players.push(player);
  room.currentSession.playerStates[player.id] = createPlayerSessionState();

  broadcastRoom(room);

  return res.status(201).json({
    message: "ルームに参加しました。",
    room: buildRoomResponse(room).room,
    playerId: player.id,
  });
});

roomsRouter.delete("/rooms/:roomId", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

  const playerId = req.body?.playerId;

  if (typeof playerId !== "string" || playerId.trim() === "") {
    return res.status(400).json({ message: "playerId は必須です。" });
  }

  if (room.hostPlayerId !== playerId) {
    return res.status(403).json({ message: "ルーム削除はホストのみ可能です。" });
  }

  closeRoom(room.id, "room_closed", {
    message: "ホストがルームを退室したため、ルームを閉じました。",
  });

  return res.status(200).json({ message: "ルームを退室しました。" });
});

roomsRouter.post("/rooms/:roomId/leave", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

  const playerId = req.body?.playerId;

  if (typeof playerId !== "string" || playerId.trim() === "") {
    return res.status(400).json({ message: "playerId は必須です。" });
  }

  const player = getPlayer(room, playerId);

  if (!player) {
    return res.status(404).json({ message: "プレイヤーが見つかりません。" });
  }

  if (room.hostPlayerId === playerId) {
    return res.status(403).json({
      message: "ホストは leave API を使用できません。",
    });
  }

  if (room.currentSession.status === "in_progress") {
    return res.status(409).json({
      message: "ゲーム進行中はルームを退室できません。",
    });
  }

  room.players = room.players.filter((currentPlayer) => currentPlayer.id !== playerId);
  delete room.currentSession.playerStates[playerId];

  if (room.currentSession.status === "waiting") {
    room.currentSession.phase = areAllPlayersReady(room)
      ? "waiting_for_host_start"
      : "waiting_for_ready";
  }

  broadcastRoom(room);

  return res.status(200).json({ message: "ルームを退室しました。" });
});

roomsRouter.get("/rooms/:roomId", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

  return res.status(200).json(buildRoomResponse(room));
});

roomsRouter.post("/rooms/:roomId/session/setup", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

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
  broadcastRoom(room);

  return res.status(200).json({
    message: "カードを作成しました。",
    room: buildRoomResponse(room).room,
    player: buildPlayerResponse(room, player),
  });
});

roomsRouter.get("/rooms/:roomId/events", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.flushHeaders?.();

  addRoomSubscriber(room.id, res);
  sendSseEvent(res, "room_updated", buildRoomResponse(room));

  const heartbeatId = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeatId);
    removeRoomSubscriber(room.id, res);
    res.end();
  });
});

roomsRouter.post("/rooms/:roomId/session/ready", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

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

  broadcastRoom(room);

  return res.status(200).json({
    message: "準備完了を受け付けました。",
    room: buildRoomResponse(room).room,
    player: buildPlayerResponse(room, player),
  });
});

roomsRouter.post("/rooms/:roomId/session/start", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

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

    broadcastRoom(room);

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
  room.currentSession.eventGauge = 0;
  room.currentSession.eventGaugeMax = calculateEventGaugeMax(room.players.length);
  room.currentSession.currentEvent = null;

  room.players.forEach((player) => {
    room.currentSession.playerStates[player.id].hasActedThisRound = false;
    room.currentSession.playerStates[player.id].hasSubmittedEventChoice = false;
  });

  broadcastRoom(room);

  return res.status(200).json({
    message: "セッションを開始しました。",
    drawNumber: result.drawnNumber,
    room: buildRoomResponse(room).room,
  });
});

roomsRouter.post("/rooms/:roomId/session/act", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

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

  const matchedCell = playerState.card.cells.find((cell) => {
    return cell.value === drawnNumber && !cell.isFree;
  });
  const shouldIncreaseEventGauge = Boolean(matchedCell && !matchedCell.isOpened);

  playerState.card = openCellByDrawnNumber(playerState.card, drawnNumber);
  playerState.hasActedThisRound = true;

  if (shouldIncreaseEventGauge) {
    room.currentSession.eventGauge += EVENT_GAUGE_INCREMENT_PER_OPEN;
  }

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

  broadcastRoom(room);

  return res.status(200).json({
    message: "このラウンドの操作を受け付けました。",
    room: buildRoomResponse(room).room,
    player: buildPlayerResponse(room, player),
  });
});

roomsRouter.get("/rooms/:roomId/session/event-choice", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

  if (room.currentSession.status !== "in_progress") {
    return res.status(409).json({
      message: "セッション進行中ではありません。",
    });
  }

  if (room.currentSession.phase !== "waiting_for_event_choices") {
    return res.status(409).json({
      message: "現在はイベント選択を受け付ける段階ではありません。",
    });
  }

  if (!room.currentSession.currentEvent) {
    return res.status(409).json({
      message: "このラウンドで選択中のイベントはありません。",
    });
  }

  const playerId =
    typeof req.query.playerId === "string" ? req.query.playerId : null;

  if (!playerId) {
    return res.status(400).json({ message: "playerId は必須です。" });
  }

  const player = getPlayer(room, playerId);

  if (!player) {
    return res.status(404).json({ message: "プレイヤーが見つかりません。" });
  }

  const segment = getPlayerEventSegment(room.currentSession.currentEvent, playerId);

  if (!segment) {
    return res.status(404).json({ message: "担当イベント区間が見つかりません。" });
  }

  return res.status(200).json({
    eventChoice: {
      order: segment.order,
      from: segment.from,
      options: buildEventChoiceOptions(segment),
      hasSubmittedChoice:
        room.currentSession.playerStates[playerId].hasSubmittedEventChoice,
    },
  });
});

roomsRouter.post("/rooms/:roomId/session/event-choice", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

  if (room.currentSession.status !== "in_progress") {
    return res.status(409).json({
      message: "セッション進行中ではありません。",
    });
  }

  if (room.currentSession.phase !== "waiting_for_event_choices") {
    return res.status(409).json({
      message: "現在はイベント選択を受け付ける段階ではありません。",
    });
  }

  if (!room.currentSession.currentEvent) {
    return res.status(409).json({
      message: "このラウンドで選択中のイベントはありません。",
    });
  }

  const playerId = req.body?.playerId;
  const player = getPlayer(room, playerId);

  if (!player) {
    return res.status(404).json({ message: "プレイヤーが見つかりません。" });
  }

  const direction = parseEventDirection(req.body?.direction);

  if (!direction) {
    return res.status(400).json({
      message: "direction は clockwise または counterclockwise を指定してください。",
    });
  }

  const playerState = getPlayerState(room.currentSession, playerId);

  if (!playerState) {
    return res.status(404).json({
      message: "プレイヤー状態が見つかりません。",
    });
  }

  if (playerState.hasSubmittedEventChoice) {
    return res.status(409).json({
      message: "このラウンドのイベント選択は完了しています。",
    });
  }

  const segment = getPlayerEventSegment(room.currentSession.currentEvent, playerId);

  if (!segment) {
    return res.status(404).json({ message: "担当イベント区間が見つかりません。" });
  }

  room.currentSession.currentEvent.segments = room.currentSession.currentEvent.segments.map(
    (currentSegment) => {
      if (currentSegment.assignedPlayerId !== playerId) return currentSegment;
      return resolveEventSegmentChoice(currentSegment, direction);
    },
  );
  playerState.hasSubmittedEventChoice = true;

  if (haveAllPlayersSubmittedEventChoice(room)) {
    room.currentSession.currentEvent.resolvedTimeline = buildResolvedTimeline(
      room.currentSession.currentEvent,
    );
    room.currentSession.currentDrawnNumber =
      room.currentSession.currentEvent.goalNumber;
    room.currentSession.drawnNumbers = [
      ...room.currentSession.drawnNumbers,
      room.currentSession.currentEvent.goalNumber,
    ];
    room.currentSession.eventGauge = 0;
    room.currentSession.phase = "waiting_for_player_actions";
  }

  broadcastRoom(room);

  return res.status(200).json({
    message: "イベント選択を受け付けました。",
    room: buildRoomResponse(room).room,
    player: buildPlayerResponse(room, player),
  });
});

roomsRouter.post("/rooms/:roomId/session/next-round", (req, res) => {
  const room = getRoomOr404(req.params.roomId, res);

  if (!room) return;

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

  const result = prepareNextRound(room);

  broadcastRoom(room);

  if (result.drawnNumber === null) {
    return res.status(200).json({
      message: "すべての番号が抽選されたためセッションを終了しました。",
      room: buildRoomResponse(room).room,
    });
  }

  return res.status(200).json({
    message: "次ラウンドへ移行しました。",
    drawNumber: result.drawnNumber,
    room: buildRoomResponse(room).room,
  });
});
