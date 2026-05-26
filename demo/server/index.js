import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { courierPayRouter } from './routes/courier-pay.js';
import { courierBonusRouter } from './routes/courier-bonus.js';
import { experimentRouter } from './routes/experiment.js';
import { offerRouter } from './routes/offer.js';
import { configRouter } from './routes/config.js';
import { streamRouter } from './routes/stream.js';
import { dispatchRouter } from './routes/dispatch.js';
import { approachesRouter } from './routes/approaches.js';

const PORT = process.env.PORT || 3001;
const app = express();

app.use(express.json({ limit: '1mb' }));

app.use('/api/courier-pay', courierPayRouter);
app.use('/api/courier-bonus', courierBonusRouter);
app.use('/api/experiment', experimentRouter);
app.use('/api/offer', offerRouter);
app.use('/api/stream', streamRouter); // SSE: server → courier push channel
app.use('/api/dispatch', dispatchRouter); // producer: simulate JobSummaryUpdated event
app.use('/api/approaches', approachesRouter); // A vs B vs C comparison
app.use('/api', configRouter); // /api/config/:tenant and /api/tenants

// In production, serve the Vite build from the same port as the API. In dev,
// Vite runs separately on 5173 and proxies /api → 3001, so this block is a no-op.
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distDir));

  // SPA fallback: anything that isn't /api/* falls back to index.html so React
  // Router can handle client-side routes like /admin, /client, /approaches.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: err.message ?? 'unknown' });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
