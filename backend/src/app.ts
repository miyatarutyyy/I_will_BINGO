import cors from "cors";
import express from "express";

import { roomsRouter } from "./routes/rooms.js";

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value !== "");

app.use(
  cors({
    origin: allowedOrigins.length === 0 ? true : allowedOrigins,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(roomsRouter);

export default app;
