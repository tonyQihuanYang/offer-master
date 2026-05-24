import { Router } from 'express';
import { CONFIGS_PATH, SAMPLE_OFFERS_PATH, readJson } from '../lib/storage.js';
import { buildOffer } from '../lib/assemble.js';

export const approachesRouter = Router();

// GET /api/approaches/:tenant?courierId=
//
// Returns the SAME offer expressed three ways, so you can SEE how each approach
// puts a different shape on the wire and pushes logic to a different place:
//
//   A (Template/DSL): server renders final display strings; mobile paints them.
//   B (Raw + mobile): server sends raw data + flags; mobile decides everything.
//   C (Hybrid):       server sends layout[] + raw data; mobile renders via registry.
approachesRouter.get('/:tenant', async (req, res) => {
  const { tenant } = req.params;
  const courierId = String(req.query.courierId || 'c123');
  const [configs, samples] = await Promise.all([readJson(CONFIGS_PATH), readJson(SAMPLE_OFFERS_PATH)]);
  const cfg = configs[tenant];
  const sample = samples[tenant];
  if (!cfg) return res.status(404).json({ error: `unknown tenant: ${tenant}` });
  if (!sample) return res.status(404).json({ error: `no sample offer for tenant: ${tenant}` });

  // C — the existing hybrid payload (control variant for stability).
  const c = buildOffer({ tenant, courierId, forceVariant: 'control', cfg, sample });
  const e = c.data.earnings || {};
  const sym = e.currency_symbol || '$';
  const money = (cents) => `${sym}${((cents || 0) / 100).toFixed(2)}`;
  const dist = c.data.distance_summary || {};
  const stops = sample.stops || [];
  const icon = (s) => (s.type === 'COLLECT' ? '🏪' : '🏠');

  // A — SERVER did all formatting & layout; the payload is finished display widgets.
  const A = {
    approach: 'A',
    who: 'Server decides EVERYTHING (what, order, AND how it looks). Mobile is a dumb painter.',
    rendered: [
      { widget: 'amount', text: money(e.total) },
      { widget: 'subtitle', text: e.includes_tip ? 'Includes tip' : '' },
      { widget: 'muted', text: dist.display || '' },
      ...stops.map((s) => ({ widget: 'row', text: `${icon(s)} ${s.name}${s.address ? ' — ' + s.address : ''}` })),
      { widget: 'cta', text: 'Accept offer' },
    ],
  };

  // B — SERVER sends raw data + flags only; MOBILE owns layout + formatting.
  const B = {
    approach: 'B',
    who: 'Server sends raw data + flags. Mobile decides which widgets, the order, and the formatting.',
    data: {
      base_pay: e.base_pay,
      tip: e.tip,
      total: e.total, // cents — note: NOT formatted
      currency_symbol: sym,
      includes_tip: e.includes_tip,
      distance: dist.value,
      unit: dist.unit,
      stops: stops.map((s) => ({ type: s.type, name: s.name, address: s.address })),
    },
    flags: { earnings_style: 'total', show_surge: false },
  };

  // C — server sends layout[] + raw data + hints; mobile renders via registry.
  const C = {
    approach: 'C',
    who: 'Server decides what + order (layout). Mobile decides how (formats + renders natively).',
    payload: c,
  };

  res.json({ tenant, courierId, A, B, C });
});
