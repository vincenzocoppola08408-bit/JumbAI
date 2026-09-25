// ============================================================
// lib/websocket-server.js — WebSocket per runtime Cloud (Vercel)
// Autenticazione JWT + stanze private per utente
// ============================================================
import { Server } from 'ws';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const WS_PORT = process.env.WS_PORT || 8080;

// Mappa di WebSocket in memoria: userId -> Set of connections
const userConnections = new Map();

export function createWebSocketServer() {
  const server = new Server({ port: WS_PORT });

  server.on('connection', (ws) => {
    let userId = null;

    // Autenticazione via JWT handshake
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'auth') {
          const token = msg.token;
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId;
          
          // Associa questa connessione all'utente
          if (!userConnections.has(userId)) {
            userConnections.set(userId, new Set());
          }
          userConnections.get(userId).add(ws);
          
          // Invia messaggio di benvenuto
          ws.send(JSON.stringify({ type: 'auth_success', userId }));
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (msg.type === 'join_room') {
          // Unisci a una stanza (es. 'room_user_' + userId)
          ws.room = msg.room;
          ws.send(JSON.stringify({ type: 'room_joined', room: ws.room }));
        } else {
          console.log('Messaggio WebSocket non riconosciuto:', msg);
        }
      } catch (err) {
        console.error('Errore autenticazione WebSocket:', err);
        ws.close(1008, 'Autenticazione fallita');
      }
    });

    ws.on('close', () => {
      if (userId && userConnections.has(userId)) {
        const conns = userConnections.get(userId);
        conns.delete(ws);
        if (conns.size === 0) {
          userConnections.delete(userId);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  console.log(`WebSocket server in ascolto su ws://localhost:${WS_PORT}`);
  return server;
}

/**
 * Invia un messaggio a una stanza specifica
 * @param {string} room - es. 'room_user_123'
 * @param {object} payload
 */
export function emitToRoom(room, payload) {
  const conns = userConnections.get(room);
  if (!conns) return;
  const message = JSON.stringify(payload);
  for (const ws of conns) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

/**
 * Invia un messaggio a un singolo WebSocket
 */
export function emit(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

/**
 * Helper: costruisce il payload WebSocket per generazione completata
 */
export function makeGenerationCompletedPayload(generationData, imageUrl, userId) {
  return {
    type: 'generation_completed',
    image_url: imageUrl,
    prompt: generationData.prompt,
    buzz_cost: generationData.buzz_cost,
    generation_id: generationData.id,
    created_at: generationData.created_at,
    user_id: userId
  };
}