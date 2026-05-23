import { Router } from 'express';
import { CONFIGS_PATH, SAMPLE_OFFERS_PATH, readJson } from '../lib/storage.js';
import { buildOffer } from '../lib/assemble.js';
import { bus } from '../lib/eventBus.js';

export const dispatchRouter = Router();

// POST /api/dispatch
//   body: { tenant, courierId, forceVariant? }
//
// The producer side of the event-driven path. This simulates a
// "JobSummaryUpdated" event arriving from Courier Management: the server
// assembles the offer payload (same logic as the pull endpoint) and *pushes*
// it to whatever SSE connections are open for that courier. The producer is
// decoupled from the consumer — it just publishes to the bus.
dispatchRouter.post('/', async (req, res) => {
  const { tenant = 'CA', courierId = 'c123', forceVariant } = req.body || {};

  const [configs, samples] = await Promise.all([readJson(CONFIGS_PATH), readJson(SAMPLE_OFFERS_PATH)]);
  const cfg = configs[tenant];
  const sample = samples[tenant];
  if (!cfg) return res.status(404).json({ error: `unknown tenant: ${tenant}` });
  if (!sample) return res.status(404).json({ error: `no sample offer for tenant: ${tenant}` });

  const payload = buildOffer({ tenant, courierId, forceVariant, cfg, sample });
  const delivered = bus.publish(courierId, 'offer', payload);

  res.json({
    dispatched: true,
    courierId,
    tenant,
    delivered, // how many open connections received it (0 = no one listening)
    subscribers: bus.count(courierId),
  });
});
