import { Router } from 'express';
import { CONFIGS_PATH, SAMPLE_OFFERS_PATH, readJson } from '../lib/storage.js';
import { assemblePayload, buildOffer } from '../lib/assemble.js';

export const offerRouter = Router();

// GET /api/offer/:tenant?courierId=...&forceVariant=control|treatment
//
// The pull (request/response) path. Kept for the admin preview and as a simple
// way to inspect a payload. The event-driven path (POST /api/dispatch → SSE
// stream) reuses the exact same assembly via buildOffer().
offerRouter.get('/:tenant', async (req, res) => {
  const { tenant } = req.params;
  const courierId = String(req.query.courierId || 'c123');
  const forceVariant = req.query.forceVariant;

  const [configs, samples] = await Promise.all([readJson(CONFIGS_PATH), readJson(SAMPLE_OFFERS_PATH)]);
  const cfg = configs[tenant];
  const sample = samples[tenant];
  if (!cfg) return res.status(404).json({ error: `unknown tenant: ${tenant}` });
  if (!sample) return res.status(404).json({ error: `no sample offer for tenant: ${tenant}` });

  res.json(buildOffer({ tenant, courierId, forceVariant, cfg, sample }));
});

// POST /api/offer/:tenant/preview
//   body: { variant: { layout, hints, earnings_model, distance_unit }, variantName }
// Renders an offer payload for an *unsaved* variant config — used by the
// admin page so editors can see how their changes will look.
offerRouter.post('/:tenant/preview', async (req, res) => {
  const { tenant } = req.params;
  const { variant, variantName = 'preview', experimentId = 'preview', treatmentPct = 0 } = req.body || {};
  if (!variant || !variant.layout) {
    return res.status(400).json({ error: 'body.variant.layout is required' });
  }

  const samples = await readJson(SAMPLE_OFFERS_PATH);
  const sample = samples[tenant];
  if (!sample) return res.status(404).json({ error: `no sample offer for tenant: ${tenant}` });

  res.json(
    assemblePayload({
      tenant,
      courierId: 'preview-courier',
      sample,
      experimentId,
      treatmentPct,
      variantName,
      variant,
      bucketValue: 0,
      assignmentSource: 'preview',
    }),
  );
});
