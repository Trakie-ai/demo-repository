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
import { extractInvoiceDataStreaming } from "./extraction/index.js";

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

  socket.on("image:captured", (data) => {
    const { sessionId } = socket.data;
    if (!sessionId) return;

    // Forward raw image immediately
    socket.to(sessionId).emit("image:captured", data);
    console.log(
      `[socket] image:captured relayed in session ${sessionId} (${data.imageData.length} chars)`
    );

    // Announce extraction start to both devices
    io.to(sessionId).emit("extraction:started", {
      sessionId,
      startedAt: new Date().toISOString(),
    });

    let fieldCount = 0;

    // Run streaming extraction async — never blocks the relay
    extractInvoiceDataStreaming(data.imageData, {
      onField: (field) => {
        fieldCount++;
        io.to(sessionId).emit("extraction:field", {
          sessionId,
          ...field,
        });
      },
    })
      .then((extraction) => {
        io.to(sessionId).emit("extraction:complete", {
          sessionId,
          extraction,
          completedAt: new Date().toISOString(),
        });
        console.log(
          `[extraction] complete for session ${sessionId} — ${extraction.lineItems?.length ?? 0} line item(s), ${fieldCount} field(s) streamed`
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        io.to(sessionId).emit("extraction:error", {
          sessionId,
          error: message,
          failedAt: new Date().toISOString(),
        });
        console.error(`[extraction] failed for session ${sessionId}:`, message);
      });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);

    const { sessionId, deviceType } = socket.data;
    if (sessionId && deviceType) {
      socket.to(sessionId).emit("session:device-disconnected", { deviceType });
    }
  });
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    "[relay] WARNING: ANTHROPIC_API_KEY not set — invoice extraction will fail"
  );
}

// Safety nets: never let the relay crash because of an unexpected error
// from the Anthropic SDK, Socket.IO, or anywhere else.
process.on("uncaughtException", (err) => {
  console.error("[relay] uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[relay] unhandledRejection:", reason);
});

httpServer.listen(PORT, () => {
  console.log(`[relay] server listening on http://localhost:${PORT}`);
});
