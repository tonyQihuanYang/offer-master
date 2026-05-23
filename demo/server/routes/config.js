import { Router } from 'express';
import { CONFIGS_PATH, readJson, writeJson } from '../lib/storage.js';

export const configRouter = Router();

configRouter.get('/tenants', async (_req, res) => {
  const configs = await readJson(CONFIGS_PATH);
  res.json({ tenants: Object.keys(configs) });
});

configRouter.get('/config/:tenant', async (req, res) => {
  const { tenant } = req.params;
  const configs = await readJson(CONFIGS_PATH);
  const cfg = configs[tenant];
  if (!cfg) return res.status(404).json({ error: `unknown tenant: ${tenant}` });
  res.json(cfg);
});

configRouter.put('/config/:tenant', async (req, res) => {
  const { tenant } = req.params;
  const next = req.body;
  if (!next || typeof next !== 'object') {
    return res.status(400).json({ error: 'body must be a tenant config object' });
  }
  const configs = await readJson(CONFIGS_PATH);
  if (!configs[tenant]) return res.status(404).json({ error: `unknown tenant: ${tenant}` });
  // Shallow validation
  if (!next.experiment_id || !next.variants?.control || !next.variants?.treatment) {
    return res.status(400).json({ error: 'config must include experiment_id and variants.control + variants.treatment' });
  }
  configs[tenant] = next;
  await writeJson(CONFIGS_PATH, configs);
  res.json(next);
});
