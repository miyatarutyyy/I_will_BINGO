import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../app.js";
import { getRoom } from "../store/room-store.js";

const createRoom = async (name = "host") => {
  const response = await request(app).post("/rooms").send({ name });

  expect(response.status).toBe(201);

  return {
    roomId: response.body.room.id as string,
    hostPlayerId: response.body.playerId as string,
  };
};

const joinRoom = async (roomId: string, name = "guest") => {
  const response = await request(app)
    .post(`/rooms/${roomId}/join`)
    .send({ name });

  expect(response.status).toBe(201);

  return {
    playerId: response.body.playerId as string,
  };
};

const deleteRoom = async (roomId: string, playerId: string) => {
  return request(app).delete(`/rooms/${roomId}`).send({ playerId });
};

const leaveRoom = async (roomId: string, playerId: string) => {
  return request(app).post(`/rooms/${roomId}/leave`).send({ playerId });
};

const setupPlayer = async (roomId: string, playerId: string) => {
  return request(app).post(`/rooms/${roomId}/session/setup`).send({ playerId });
};

const readyPlayer = async (roomId: string, playerId: string) => {
  return request(app).post(`/rooms/${roomId}/session/ready`).send({ playerId });
};

const startSession = async (roomId: string, playerId: string) => {
  return request(app).post(`/rooms/${roomId}/session/start`).send({ playerId });
};

const actPlayer = async (roomId: string, playerId: string) => {
  return request(app).post(`/rooms/${roomId}/session/act`).send({ playerId });
};

const moveToNextRound = async (roomId: string, playerId: string) => {
  return request(app)
    .post(`/rooms/${roomId}/session/next-round`)
    .send({ playerId });
};

describe.sequential("roomsRouter", () => {
  it("ルームを作成できる", async () => {
    const response = await request(app).post("/rooms").send({ name: "host" });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("ルームを作成しました。");
    expect(response.body.playerId).toMatch(/^player-/);
    expect(response.body.room.id).toMatch(/^room-/);
    expect(response.body.room.hostPlayerId).toBe(response.body.playerId);
    expect(response.body.room.players).toHaveLength(1);
    expect(response.body.room.currentSession.status).toBe("waiting");
    expect(response.body.room.currentSession.phase).toBe("waiting_for_ready");
  });

  it("カード作成と ready 完了後にホストがセッションを開始できる", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    const hostSetupResponse = await setupPlayer(roomId, hostPlayerId);
    const guestSetupResponse = await setupPlayer(roomId, guestPlayerId);

    expect(hostSetupResponse.status).toBe(200);
    expect(guestSetupResponse.status).toBe(200);
    expect(hostSetupResponse.body.player.card.cells).toHaveLength(25);
    expect(guestSetupResponse.body.player.card.cells).toHaveLength(25);

    const hostReadyResponse = await readyPlayer(roomId, hostPlayerId);
    const guestReadyResponse = await readyPlayer(roomId, guestPlayerId);

    expect(hostReadyResponse.status).toBe(200);
    expect(guestReadyResponse.status).toBe(200);
    expect(guestReadyResponse.body.room.currentSession.phase).toBe(
      "waiting_for_host_start",
    );

    const startResponse = await startSession(roomId, hostPlayerId);

    expect(startResponse.status).toBe(200);
    expect(startResponse.body.drawNumber).toEqual(expect.any(Number));
    expect(startResponse.body.room.currentSession.status).toBe("in_progress");
    expect(startResponse.body.room.currentSession.phase).toBe(
      "waiting_for_player_actions",
    );
    expect(startResponse.body.room.currentSession.round).toBe(1);
    expect(startResponse.body.room.currentSession.drawnNumbers).toHaveLength(1);
    expect(startResponse.body.room.currentSession.eventGauge).toBe(0);
    expect(startResponse.body.room.currentSession.eventGaugeMax).toBe(60);
  });

  it("ホスト以外はセッションを開始できない", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);

    const response = await startSession(roomId, guestPlayerId);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("セッション開始はホストのみ可能です。");
  });

  it("ホストは待機中ルームを削除できる", async () => {
    const { roomId, hostPlayerId } = await createRoom();

    const deleteResponse = await deleteRoom(roomId, hostPlayerId);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.message).toBe("ルームを退室しました。");

    const getResponse = await request(app).get(`/rooms/${roomId}`);

    expect(getResponse.status).toBe(404);
    expect(getResponse.body.message).toBe("ルームが見つかりません。");
  });

  it("ホスト以外はルームを削除できない", async () => {
    const { roomId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    const response = await deleteRoom(roomId, guestPlayerId);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("ルーム削除はホストのみ可能です。");
  });

  it("playerId なしではルームを削除できない", async () => {
    const { roomId } = await createRoom();

    const response = await request(app).delete(`/rooms/${roomId}`).send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("playerId は必須です。");
  });

  it("非ホストは待機中ルームを退室できる", async () => {
    const { roomId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    const leaveResponse = await leaveRoom(roomId, guestPlayerId);

    expect(leaveResponse.status).toBe(200);
    expect(leaveResponse.body.message).toBe("ルームを退室しました。");

    const getResponse = await request(app).get(`/rooms/${roomId}`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.room.players).toHaveLength(1);
    expect(
      getResponse.body.room.players.every(
        (player: { id: string }) => player.id !== guestPlayerId,
      ),
    ).toBe(true);
  });

  it("ゲーム進行中は非ホストでも退室できない", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);
    await startSession(roomId, hostPlayerId);

    const response = await leaveRoom(roomId, guestPlayerId);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("ゲーム進行中はルームを退室できません。");
  });

  it("ホストは leave API を使用できない", async () => {
    const { roomId, hostPlayerId } = await createRoom();

    const response = await leaveRoom(roomId, hostPlayerId);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("ホストは leave API を使用できません。");
  });

  it("全員が act すると次ラウンド待ちへ遷移し、next-round でラウンドが進む", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);

    const startResponse = await startSession(roomId, hostPlayerId);

    expect(startResponse.status).toBe(200);

    const hostActResponse = await actPlayer(roomId, hostPlayerId);

    expect(hostActResponse.status).toBe(200);
    expect(hostActResponse.body.player.hasActedThisRound).toBe(true);
    expect(hostActResponse.body.room.currentSession.phase).toBe(
      "waiting_for_player_actions",
    );

    const guestActResponse = await actPlayer(roomId, guestPlayerId);

    expect(guestActResponse.status).toBe(200);
    expect(guestActResponse.body.player.hasActedThisRound).toBe(true);
    expect(guestActResponse.body.room.currentSession.phase).toBe(
      "waiting_for_host_next_round",
    );

    const nextRoundResponse = await moveToNextRound(roomId, hostPlayerId);

    expect(nextRoundResponse.status).toBe(200);
    expect(nextRoundResponse.body.drawNumber).toEqual(expect.any(Number));
    expect(nextRoundResponse.body.room.currentSession.round).toBe(2);
    expect(nextRoundResponse.body.room.currentSession.phase).toBe(
      "waiting_for_player_actions",
    );
    expect(nextRoundResponse.body.room.currentSession.drawnNumbers).toHaveLength(
      2,
    );

    const players = nextRoundResponse.body.room.players as Array<{
      hasActedThisRound: boolean;
    }>;

    expect(players.every((player) => player.hasActedThisRound === false)).toBe(
      true,
    );
  });

  it("通常マスを新しく開いたときだけイベントゲージが加算される", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);
    await startSession(roomId, hostPlayerId);

    const room = getRoom(roomId);
    expect(room).not.toBeNull();

    if (!room) return;

    const hostState = room.currentSession.playerStates[hostPlayerId];
    expect(hostState.card).not.toBeNull();

    if (!hostState.card) return;

    const closedNormalCell = hostState.card.cells.find((cell) => {
      return !cell.isFree && !cell.isOpened && typeof cell.value === "number";
    });

    expect(closedNormalCell).toBeDefined();

    if (!closedNormalCell || typeof closedNormalCell.value !== "number") return;

    room.currentSession.currentDrawnNumber = closedNormalCell.value;

    const firstActResponse = await actPlayer(roomId, hostPlayerId);

    expect(firstActResponse.status).toBe(200);
    expect(firstActResponse.body.room.currentSession.eventGauge).toBe(10);

    room.currentSession.currentDrawnNumber = closedNormalCell.value;

    const secondActResponse = await actPlayer(roomId, guestPlayerId);

    expect(secondActResponse.status).toBe(200);
    expect(secondActResponse.body.room.currentSession.eventGauge).toBe(10);
  });

  it("カード未作成のまま ready はできない", async () => {
    const { roomId, hostPlayerId } = await createRoom();

    const response = await readyPlayer(roomId, hostPlayerId);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("カード作成後に ready を送信してください。");
  });

  it("存在しないルームは 404 を返す", async () => {
    const response = await request(app).get("/rooms/room-not-found");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("ルームが見つかりません。");
  });

  it("準備完了フェーズを過ぎたルームには参加できない", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);

    const response = await request(app)
      .post(`/rooms/${roomId}/join`)
      .send({ name: "late-guest" });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "準備完了の受付が始まった後は新規参加できません。",
    );
  });

  it("同じプレイヤーは同一セッションでカードを再作成できない", async () => {
    const { roomId, hostPlayerId } = await createRoom();

    const firstResponse = await setupPlayer(roomId, hostPlayerId);
    const secondResponse = await setupPlayer(roomId, hostPlayerId);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.message).toBe("カードはすでに作成されています。");
  });

  it("同じプレイヤーは ready を二重送信できない", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);

    const firstResponse = await readyPlayer(roomId, hostPlayerId);
    const secondResponse = await readyPlayer(roomId, hostPlayerId);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.message).toBe("すでに ready 済みです。");
  });

  it("全員 ready 前にホストはセッションを開始できない", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);

    const response = await startSession(roomId, hostPlayerId);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe("全員の準備完了後に開始できます。");
  });

  it("同じラウンドで act は二重実行できない", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);
    await startSession(roomId, hostPlayerId);

    const firstResponse = await actPlayer(roomId, hostPlayerId);
    const secondResponse = await actPlayer(roomId, hostPlayerId);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.message).toBe("このラウンドはすでに操作済みです。");
  });

  it("全員が act する前に次ラウンドへは進めない", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);
    await startSession(roomId, hostPlayerId);
    await actPlayer(roomId, hostPlayerId);

    const response = await moveToNextRound(roomId, hostPlayerId);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "全員の操作完了後にのみ次ラウンドへ進めます。",
    );
  });

  it("ホスト以外は次ラウンドへ進めない", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const { playerId: guestPlayerId } = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);
    await startSession(roomId, hostPlayerId);
    await actPlayer(roomId, hostPlayerId);
    await actPlayer(roomId, guestPlayerId);

    const response = await moveToNextRound(roomId, guestPlayerId);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("次ラウンドへの移行はホストのみ可能です。");
  });
});
