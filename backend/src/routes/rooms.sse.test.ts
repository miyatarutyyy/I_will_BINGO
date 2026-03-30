import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../store/room-store.js", async () => {
  const actual = await vi.importActual<typeof import("../store/room-store.js")>(
    "../store/room-store.js",
  );

  return {
    ...actual,
    broadcastRoom: vi.fn(actual.broadcastRoom),
  };
});

import app from "../app.js";
import { getRoom } from "../store/room-store.js";
import { broadcastRoom } from "../store/room-store.js";

const broadcastRoomMock = vi.mocked(broadcastRoom);

const createRoom = async () => {
  const response = await request(app).post("/rooms").send({ name: "host" });

  expect(response.status).toBe(201);

  return {
    roomId: response.body.room.id as string,
    hostPlayerId: response.body.playerId as string,
  };
};

const joinRoom = async (roomId: string) => {
  const response = await request(app)
    .post(`/rooms/${roomId}/join`)
    .send({ name: "guest" });

  expect(response.status).toBe(201);

  return response.body.playerId as string;
};

const setupPlayer = async (roomId: string, playerId: string) => {
  const response = await request(app)
    .post(`/rooms/${roomId}/session/setup`)
    .send({ playerId });

  expect(response.status).toBe(200);
};

const readyPlayer = async (roomId: string, playerId: string) => {
  const response = await request(app)
    .post(`/rooms/${roomId}/session/ready`)
    .send({ playerId });

  expect(response.status).toBe(200);
};

const startSession = async (roomId: string, playerId: string) => {
  const response = await request(app)
    .post(`/rooms/${roomId}/session/start`)
    .send({ playerId });

  expect(response.status).toBe(200);
};

const actPlayer = async (roomId: string, playerId: string) => {
  const response = await request(app)
    .post(`/rooms/${roomId}/session/act`)
    .send({ playerId });

  expect(response.status).toBe(200);
};

const submitEventChoice = async (
  roomId: string,
  playerId: string,
  direction: "clockwise" | "counterclockwise",
) => {
  const response = await request(app)
    .post(`/rooms/${roomId}/session/event-choice`)
    .send({ playerId, direction });

  expect(response.status).toBe(200);
};

describe.sequential("roomsRouter SSE", () => {
  beforeEach(() => {
    broadcastRoomMock.mockClear();
  });

  it("next-round 成功時に room_updated 用の broadcastRoom を呼ぶ", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const guestPlayerId = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);
    await startSession(roomId, hostPlayerId);
    await actPlayer(roomId, hostPlayerId);
    await actPlayer(roomId, guestPlayerId);

    broadcastRoomMock.mockClear();

    const response = await request(app)
      .post(`/rooms/${roomId}/session/next-round`)
      .send({ playerId: hostPlayerId });

    expect(response.status).toBe(200);
    expect(broadcastRoomMock).toHaveBeenCalledTimes(1);

    const [updatedRoom] = broadcastRoomMock.mock.calls[0];

    expect(updatedRoom.id).toBe(roomId);
    expect(updatedRoom.currentSession.round).toBe(2);
    expect(updatedRoom.currentSession.phase).toBe(
      "waiting_for_player_actions",
    );
    expect(updatedRoom.currentSession.currentDrawnNumber).toEqual(
      expect.any(Number),
    );
    expect(updatedRoom.currentSession.drawnNumbers).toHaveLength(2);
    expect(
      Object.values(updatedRoom.currentSession.playerStates).every(
        (state) =>
          state.hasActedThisRound === false &&
          state.hasSubmittedEventChoice === false,
      ),
    ).toBe(true);
  });

  it("event-choice 成功時に room_updated 用の broadcastRoom を呼ぶ", async () => {
    const { roomId, hostPlayerId } = await createRoom();
    const guestPlayerId = await joinRoom(roomId);

    await setupPlayer(roomId, hostPlayerId);
    await setupPlayer(roomId, guestPlayerId);
    await readyPlayer(roomId, hostPlayerId);
    await readyPlayer(roomId, guestPlayerId);
    await startSession(roomId, hostPlayerId);
    await actPlayer(roomId, hostPlayerId);
    await actPlayer(roomId, guestPlayerId);

    const room = getRoom(roomId);
    expect(room).not.toBeNull();

    if (!room) return;

    room.currentSession.eventGauge = room.currentSession.eventGaugeMax;

    await request(app)
      .post(`/rooms/${roomId}/session/next-round`)
      .send({ playerId: hostPlayerId });

    broadcastRoomMock.mockClear();

    await submitEventChoice(roomId, hostPlayerId, "clockwise");

    expect(broadcastRoomMock).toHaveBeenCalledTimes(1);

    const [updatedRoom] = broadcastRoomMock.mock.calls[0];

    expect(updatedRoom.currentSession.phase).toBe("waiting_for_event_choices");
    expect(
      updatedRoom.currentSession.playerStates[hostPlayerId].hasSubmittedEventChoice,
    ).toBe(true);
  });
});
