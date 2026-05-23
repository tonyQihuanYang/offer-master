import { Router } from 'express';
import { CONFIGS_PATH, readJson } from '../lib/storage.js';
import { bucket } from '../lib/hash.js';

export const experimentRouter = Router();

// GET /api/experiment/:courierId?experimentId=...&treatmentPct=...&forceVariant=...
//
// Either pass treatmentPct directly, or pass tenant= so the resolver can read
// it from configs.json. forceVariant overrides the hash for the preview toggle.
experimentRouter.get('/:courierId', async (req, res) => {
  const { courierId } = req.params;
  const { experimentId, tenant, forceVariant } = req.query;
  let { treatmentPct } = req.query;

  if (!experimentId && !tenant) {
    return res.status(400).json({ error: 'experimentId or tenant required' });
  }

  let resolvedExperimentId = experimentId;
  if (treatmentPct == null && tenant) {
    const configs = await readJson(CONFIGS_PATH);
    const cfg = configs[tenant];
    if (!cfg) return res.status(404).json({ error: `unknown tenant: ${tenant}` });
    resolvedExperimentId = cfg.experiment_id;
    treatmentPct = cfg.treatment_pct;
  }

  treatmentPct = Number(treatmentPct ?? 0);
  if (Number.isNaN(treatmentPct) || treatmentPct < 0 || treatmentPct > 100) {
    return res.status(400).json({ error: 'treatmentPct must be 0..100' });
  }

  if (forceVariant === 'control' || forceVariant === 'treatment') {
    return res.json({
      courierId,
      experimentId: resolvedExperimentId,
      variant: forceVariant,
      group: forceVariant,
      rolloutPct: treatmentPct,
      bucket: bucket(courierId, resolvedExperimentId),
      source: 'override',
    });
  }

  const b = bucket(courierId, resolvedExperimentId);
  const variant = b < treatmentPct ? 'treatment' : 'control';
  res.json({
    courierId,
    experimentId: resolvedExperimentId,
    variant,
    group: variant,
    rolloutPct: treatmentPct,
    bucket: b,
    source: 'hash',
  });
});
