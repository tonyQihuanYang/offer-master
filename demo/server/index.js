import express from 'express';
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

app.use((err, _req, res, _next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: err.message ?? 'unknown' });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
