/**
 * CommonChat Global P2P Relay
 * WebSocket server: online discovery + message routing by Peer-ID.
 * Does not verify signatures; clients verify with Rust (Commonware).
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// socketId -> { peerId, displayName }
const socketToPeer = new Map();
// peerId -> Set<socketId> (one user can have multiple tabs)
const peerToSockets = new Map();

function ensureSet(peerId) {
  if (!peerToSockets.has(peerId)) peerToSockets.set(peerId, new Set());
  return peerToSockets.get(peerId);
}

function getOnlineList(excludePeerId = null) {
  const seen = new Set();
  const list = [];
  for (const [sid, info] of socketToPeer) {
    if (info.peerId === excludePeerId) continue;
    if (seen.has(info.peerId)) continue;
    seen.add(info.peerId);
    list.push({ id: info.peerId, name: info.displayName || info.peerId.slice(0, 12), pubKey: info.peerId });
  }
  return list;
}

io.on("connection", (socket) => {
  socket.on("register", (data) => {
    const { peerId, displayName } = data || {};
    if (!peerId) return;
    const name = (displayName || "").trim() || peerId.slice(0, 12);
    socketToPeer.set(socket.id, { peerId, displayName: name });
    ensureSet(peerId).add(socket.id);

    const onlineList = getOnlineList(peerId);
    socket.emit("online_list", onlineList);
    socket.broadcast.emit("user_online", {
      id: peerId,
      name,
      pubKey: peerId,
    });
  });

  socket.on("message", (payload) => {
    if (!payload || typeof payload !== "object") return;
    const recipient = payload.recipient ?? "Broadcast";
    if (recipient === "Broadcast") {
      io.emit("message", payload);
      return;
    }
    const targetSockets = peerToSockets.get(recipient);
    if (targetSockets && targetSockets.size > 0) {
      for (const sid of targetSockets) {
        io.to(sid).emit("message", payload);
      }
    }
  });

  socket.on("disconnect", () => {
    const info = socketToPeer.get(socket.id);
    socketToPeer.delete(socket.id);
    if (info) {
      const set = peerToSockets.get(info.peerId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) peerToSockets.delete(info.peerId);
      }
      socket.broadcast.emit("user_offline", { peerId: info.peerId });
    }
  });
});

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, () => {
  console.log(`CommonChat Relay listening on port ${PORT}`);
});
