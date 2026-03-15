import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  SocketData,
} from "./types.js";

const PORT = parseInt(process.env.PORT || "3001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("session:join", async (data, callback) => {
    const { sessionId, deviceType } = data;

    if (!sessionId || !deviceType) {
      callback({ ok: false, error: "Missing sessionId or deviceType" });
      return;
    }

    if (deviceType !== "extension" && deviceType !== "mobile") {
      callback({ ok: false, error: "Invalid deviceType" });
      return;
    }

    // Check for duplicate device type already in room
    const room = io.sockets.adapter.rooms.get(sessionId);
    if (room) {
      for (const sid of room) {
        const existing = io.sockets.sockets.get(sid);
        if (existing && existing.data.deviceType === deviceType) {
          callback({
            ok: false,
            error: `A ${deviceType} is already in this session`,
          });
          return;
        }
      }
    }

    // Store session info on socket and join room
    socket.data.sessionId = sessionId;
    socket.data.deviceType = deviceType;
    await socket.join(sessionId);

    console.log(
      `[socket] ${deviceType} ${socket.id} joined session ${sessionId}`
    );
    callback({ ok: true });

    // Check if both devices are now in the room
    const updatedRoom = io.sockets.adapter.rooms.get(sessionId);
    if (updatedRoom && updatedRoom.size === 2) {
      io.to(sessionId).emit("session:paired", { deviceType });
      console.log(`[socket] session ${sessionId} paired`);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);

    const { sessionId, deviceType } = socket.data;
    if (sessionId && deviceType) {
      socket.to(sessionId).emit("session:device-disconnected", { deviceType });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[relay] server listening on http://localhost:${PORT}`);
});
