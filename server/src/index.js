import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

const origin = process.env.ALLOWED_ORIGIN?.split(',').map(s => s.trim());
const io = new Server(httpServer, {
  cors: {
    origin: origin || '*',
    methods: ['GET', 'POST']
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

// In-memory room mapping: roomId => [socketIds]
const rooms = new Map();

function getPeers(roomId) {
  return rooms.get(roomId) || [];
}

io.on('connection', (socket) => {
  socket.on('join', ({ roomId }) => {
    socket.join(roomId);
    const peers = getPeers(roomId);
    rooms.set(roomId, [...peers, socket.id]);

    // Notify others
    socket.to(roomId).emit('peer-joined', { socketId: socket.id });
  });

  socket.on('signal', ({ roomId, to, data }) => {
    io.to(to).emit('signal', { from: socket.id, data, roomId });
  });

  socket.on('leave', ({ roomId }) => {
    socket.leave(roomId);
    const peers = getPeers(roomId).filter(id => id !== socket.id);
    rooms.set(roomId, peers);
    socket.to(roomId).emit('peer-left', { socketId: socket.id });
  });

  socket.on('disconnect', () => {
    // Remove socket from all rooms
    for (const [roomId, peers] of rooms.entries()) {
      if (peers.includes(socket.id)) {
        const next = peers.filter(id => id !== socket.id);
        rooms.set(roomId, next);
        socket.to(roomId).emit('peer-left', { socketId: socket.id });
      }
    }
  });
});

const PORT = process.env.PORT || 6000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server running on http://0.0.0.0:${PORT}`);
});