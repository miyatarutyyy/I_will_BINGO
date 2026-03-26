import cors from "cors";
import express from "express";

import { roomsRouter } from "./routes/rooms.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(roomsRouter);

export default app;
