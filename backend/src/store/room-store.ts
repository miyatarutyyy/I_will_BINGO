import type { Response } from "express";

import { buildRoomResponse } from "../services/room-response.js";
import type { Room } from "../types/session.js";

const rooms = new Map<string, Room>();
const roomSubscribers = new Map<string, Set<Response>>();

const getRoomSubscribers = (roomId: string): Set<Response> => {
  const subscribers = roomSubscribers.get(roomId);

  if (subscribers) return subscribers;

  const nextSubscribers = new Set<Response>();
  roomSubscribers.set(roomId, nextSubscribers);
  return nextSubscribers;
};

export const saveRoom = (room: Room) => {
  rooms.set(room.id, room);
};

export const getRoom = (roomId: string): Room | null => {
  return rooms.get(roomId) ?? null;
};

export const deleteRoom = (roomId: string) => {
  rooms.delete(roomId);
  roomSubscribers.delete(roomId);
};

export const sendSseEvent = (
  res: Response,
  eventName: string,
  payload: unknown,
) => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const addRoomSubscriber = (roomId: string, res: Response) => {
  const subscribers = getRoomSubscribers(roomId);
  subscribers.add(res);
};

export const removeRoomSubscriber = (roomId: string, res: Response) => {
  const subscribers = roomSubscribers.get(roomId);

  if (!subscribers) return;

  subscribers.delete(res);

  if (subscribers.size === 0) {
    roomSubscribers.delete(roomId);
  }
};

export const broadcastRoom = (room: Room) => {
  const subscribers = roomSubscribers.get(room.id);

  if (!subscribers || subscribers.size === 0) return;

  const payload = buildRoomResponse(room);

  for (const res of subscribers) {
    sendSseEvent(res, "room_updated", payload);
  }
};
