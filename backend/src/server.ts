import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { agentsRoutes } from './api/agents.routes.js';
import { sessionsRoutes } from './api/sessions.routes.js';
import { curatorRoutes } from './api/curator.routes.js';
import { queriesRoutes } from './api/queries.routes.js';
import { initDb } from './db/init.js';
import { EventWatcher } from './services/onchain/eventWatcher.js';
import { ProofRelayer } from './services/proof/proofRelayer.js';
import { TimeoutWatcher } from './services/proof/timeoutWatcher.js';
import { sseHub } from './services/realtime/sseHub.js';

const app = new Hono();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:3002').split(',').map(s => s.trim())

app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Cache-Control', 'X-Payment', 'Last-Event-ID', 'X-Wallet-Address', 'X-Signature', 'X-Timestamp'],
}));

initDb();

const eventWatcher = new EventWatcher({} as any);
const proofRelayer = new ProofRelayer();
const timeoutWatcher = new TimeoutWatcher();

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/agents', agentsRoutes);
app.route('/api/sessions', sessionsRoutes);
app.route('/api/curator', curatorRoutes);
app.route('/api/queries', queriesRoutes);
app.route('/queries', queriesRoutes);

const port = parseInt(process.env.PORT || '3001');
serve({ fetch: app.fetch, port }, async () => {
  console.log(`Backend running on http://localhost:${port}`);
  eventWatcher.start();
  await proofRelayer.start();
  timeoutWatcher.start();
  sseHub.startPingLoop();
});

export { app };
