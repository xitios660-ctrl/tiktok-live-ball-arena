import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import {
  SOCKET_EVENTS,
  DEFAULT_ROUND_DURATION_SEC,
  PHYSICS_TICK_HZ,
  type TikTokMode,
} from '@arena/shared';
import { createConnector } from './tiktok/createConnector';
import { DemoEventSimulator } from './demo/DemoEventSimulator';
import { GameLoop } from './game/GameLoop';
import { healthRouter } from './routes/health';
import { adminApiRouter } from './routes/adminApi';
import { shopApiRouter } from './routes/shopApi';
import { EconomyStore } from './economy/EconomyStore';
import {
  accessGateMiddleware,
  createAccessRouter,
  getAccessPassword,
  hasAccessFromCookieHeader,
} from './accessGate';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const MODE = ((process.env.TIKTOK_MODE || 'demo').toLowerCase() === 'production'
  ? 'production'
  : 'demo') as TikTokMode;
const USERNAME = process.env.TIKTOK_USERNAME || 'demo_host';
const ROUND_SEC = Number(process.env.ROUND_DURATION_SEC) || DEFAULT_ROUND_DURATION_SEC;

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Password gate (SITE_ACCESS_PASSWORD). /health stays open via middleware exempt.
  app.use(createAccessRouter());
  app.use(accessGateMiddleware);

  const server = http.createServer(app);
  const io = new SocketIOServer(server, { cors: { origin: '*' } });
  const economy = new EconomyStore();
  await economy.init();

  const game = new GameLoop(MODE, ROUND_SEC, economy);
  // Initialize the round BEFORE connecting to TikTok. The connector can emit
  // recent real comments/gifts during connect(); resetting afterwards would
  // erase characters that just spawned from those events.
  game.resetToWaiting();
  const connector = createConnector(MODE);

  const getDemo = (): DemoEventSimulator | null =>
    connector instanceof DemoEventSimulator ? connector : null;

  connector.on('event', (ev) => {
    game.handleLiveEvent(ev);
    io.emit(SOCKET_EVENTS.LIVE_EVENT, ev);
  });
  connector.on('connected', (info) => {
    console.log(`[TIKTOK] LIVE DETECTADA / CONECTADO`, info);
    io.emit('tiktok:status', connector.getStatus());
  });
  connector.on('disconnected', (reason) => {
    console.log(`[TIKTOK] disconnected`, reason);
    io.emit('tiktok:status', connector.getStatus());
  });
  connector.on('reconnecting', (attempt, delayMs) => {
    console.log(`[TIKTOK] RECONECTANDO #${attempt} in ${delayMs}ms`);
    io.emit('tiktok:status', connector.getStatus());
  });
  connector.on('status', (st) => {
    io.emit('tiktok:status', st);
  });
  connector.on('error', (err) => {
    console.error(`[TIKTOK] error`, err.message);
    io.emit('tiktok:status', connector.getStatus());
  });

  game.onRound((state) => io.emit(SOCKET_EVENTS.ROUND_STATE, state));
  game.onSnapshot((snap) => io.emit(SOCKET_EVENTS.GAME_SNAPSHOT, snap));
  game.onCombat((ev) => io.emit(SOCKET_EVENTS.COMBAT_EVENT, ev));

  app.use(healthRouter({ game, connector, mode: MODE }));
  app.use(shopApiRouter(economy));
  app.use(adminApiRouter({ game, getDemo, mode: MODE, connector, economy }));

  const publicDir = path.join(__dirname, '../public');
  // Gate brand assets (/assets/ball-arena/*) — exempt from password middleware
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }
  app.get('/admin', (_req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
  });
  app.get('/shop', (_req, res) => {
    res.sendFile(path.join(publicDir, 'shop.html'));
  });
  app.get('/loja', (_req, res) => {
    res.sendFile(path.join(publicDir, 'shop.html'));
  });

  const clientDist = path.resolve(__dirname, '../../client/dist');
  const serveOverlay = (_req: express.Request, res: express.Response) => {
    const indexHtml = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>Overlay</title>
<style>body{margin:0;background:#000;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column}
a{color:#fe2c55}</style></head>
<body>
  <h1>AGUARDANDO A LIVE COMEÇAR</h1>
  <p>Client build ausente. Dev: <a href="http://localhost:5173">:5173</a></p>
  <p>Admin DEMO: <a href="/admin">/admin</a></p>
</body></html>`);
    }
  };
  app.get('/overlay', serveOverlay);
  app.get('/', (_req, res) => res.redirect('/overlay'));

  if (fs.existsSync(clientDist)) {
    app.use('/overlay', express.static(clientDist));
    app.use(express.static(clientDist));
  }

  // Socket.IO requires the same access cookie as the protected pages.
  io.use((socket, next) => {
    const pwd = getAccessPassword();
    if (!pwd || process.env.PUBLIC_OVERLAY === 'true' || hasAccessFromCookieHeader(socket.handshake.headers.cookie || '')) {
      next();
      return;
    }

    const authToken = socket.handshake.auth?.access_token;
    const queryToken = socket.handshake.query?.access_token;
    const token = typeof authToken === 'string'
      ? authToken
      : typeof queryToken === 'string'
        ? queryToken
        : undefined;
    if (token === pwd) {
      next();
      return;
    }

    next(new Error('unauthorized'));
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] client ${socket.id}`);
    socket.emit(SOCKET_EVENTS.ROUND_STATE, game.getState());
    socket.emit(SOCKET_EVENTS.GAME_SNAPSHOT, game.getSnapshot());
    socket.on(SOCKET_EVENTS.CLIENT_READY, () => {
      socket.emit(SOCKET_EVENTS.ROUND_STATE, game.getState());
      socket.emit(SOCKET_EVENTS.GAME_SNAPSHOT, game.getSnapshot());
    });
  });

  try {
    await connector.connect(USERNAME);
    console.log(`[Boot] Connector status:`, connector.getStatus().label);
  } catch (err) {
    console.error(
      `[Boot] Connector connect failed (${MODE}):`,
      err instanceof Error ? err.message : err
    );
    if (MODE === 'production') {
      console.error(
        '[Boot] Production connector will keep retrying AGUARDANDO LIVE. ' +
          'Set TIKTOK_MODE=demo for local playtest without a live.'
      );
    }
  }

  server.listen(PORT, HOST, () => {
    console.log(`\n🏟️  TikTok Live Ball Arena`);
    console.log(`   mode:     ${MODE}`);
    console.log(`   physics:  ${PHYSICS_TICK_HZ} Hz (server authoritative)`);
    console.log(`   health:   http://localhost:${PORT}/health`);
    console.log(`   overlay:  http://localhost:${PORT}/overlay`);
    console.log(`   admin:    http://localhost:${PORT}/admin`);
    console.log(`   access:   ${getAccessPassword() ? 'password gate ON' : 'password gate OFF (no SITE_ACCESS_PASSWORD)'}`);
    console.log(`   tiktok:   ${connector.getStatus().label}`);
    if (MODE === 'demo') {
      console.log(`   DEMO events are SIMULATED — not real TikTok`);
    } else {
      console.log(`   PRODUCTION: direct TikTok realtime — needs @${USERNAME} publicly LIVE`);
    }
    console.log('');
  });
}

main().catch((err) => {
  console.error('Fatal', err);
  process.exit(1);
});
