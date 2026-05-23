import { Router } from 'express';
import { bus } from '../lib/eventBus.js';

export const streamRouter = Router();

// GET /api/stream?courierId=c123
//
// Server-Sent Events: a one-directional server → client push channel. This is
// the demo's analog of the AppSync WebSocket — the courier's app opens it once
// and offers are *pushed* as events arrive, instead of the app polling for them.
//
// Why SSE and not WebSocket: offer delivery only needs server → client. The
// courier's accept/decline goes back over a normal POST (a separate channel),
// so the bidirectional complexity of WebSocket isn't needed here.
streamRouter.get('/', (req, res) => {
  const courierId = String(req.query.courierId || 'c123');

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering so events flush immediately
  });
  res.flushHeaders?.();

  // Tell the client how long to wait before reconnecting, then confirm the open.
  res.write('retry: 3000\n\n');
  res.write(`event: connected\ndata: ${JSON.stringify({ courierId, at: Date.now() })}\n\n`);

  const unsubscribe = bus.subscribe(courierId, res);

  // Keep-alive comment ping so idle proxies don't drop the connection.
  const ping = setInterval(() => res.write(`: ping ${Date.now()}\n\n`), 15000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
});
