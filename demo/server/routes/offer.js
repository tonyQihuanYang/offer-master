import { Router } from 'express';
import { CONFIGS_PATH, SAMPLE_OFFERS_PATH, readJson } from '../lib/storage.js';
import { bucket } from '../lib/hash.js';

export const offerRouter = Router();

// GET /api/offer/:tenant?courierId=...&forceVariant=control|treatment
offerRouter.get('/:tenant', async (req, res) => {
  const { tenant } = req.params;
  const courierId = String(req.query.courierId || 'c123');
  const forceVariant = req.query.forceVariant;

  const [configs, samples] = await Promise.all([readJson(CONFIGS_PATH), readJson(SAMPLE_OFFERS_PATH)]);
  const cfg = configs[tenant];
  const sample = samples[tenant];
  if (!cfg) return res.status(404).json({ error: `unknown tenant: ${tenant}` });
  if (!sample) return res.status(404).json({ error: `no sample offer for tenant: ${tenant}` });

  const b = bucket(courierId, cfg.experiment_id);
  let variantName;
  let assignmentSource;
  if (forceVariant === 'control' || forceVariant === 'treatment') {
    variantName = forceVariant;
    assignmentSource = 'override';
  } else {
    variantName = b < cfg.treatment_pct ? 'treatment' : 'control';
    assignmentSource = 'hash';
  }
  const variant = cfg.variants[variantName];

  res.json(
    assemblePayload({
      tenant,
      courierId,
      sample,
      experimentId: cfg.experiment_id,
      treatmentPct: cfg.treatment_pct,
      variantName,
      variant,
      bucketValue: b,
      assignmentSource,
    }),
  );
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

function assemblePayload({
  tenant,
  courierId,
  sample,
  experimentId,
  treatmentPct,
  variantName,
  variant,
  bucketValue,
  assignmentSource,
}) {
  // Mock pay + bonus (in real system: Temporal workflow → CourierPay + CourierBonus)
  const pay = { totalRateValue: 726, tip: 250, distanceExpenseAllowance: 50 };
  const acceptance = 40 + (bucketValue % 50);
  const bonus = {
    bonuses: [
      { type: 'peak_hour', value: 100 },
      { type: 'consecutive_delivery', value: 50 },
    ],
    topUpPromotion: {
      currentAcceptanceRate: acceptance,
      requiredAcceptanceRate: 80,
      showAcceptanceRate: true,
    },
  };

  const earnings = computeEarnings(variant.earnings_model, pay, bonus, sample, variant.distance_unit);
  const data = buildData(variant.layout, sample, earnings, bonus, variant.distance_unit);

  return {
    version: 2,
    tenant,
    courier_id: courierId,
    timestamp: Date.now(),
    experiment: {
      assignments: {
        [experimentId]: {
          variant: variantName,
          group: variantName,
          rolloutPct: treatmentPct,
          bucket: bucketValue,
          source: assignmentSource,
        },
      },
    },
    layout: {
      components: variant.layout,
      hints: variant.hints || {},
    },
    data,
  };
}

function computeEarnings(model, pay, bonus, sample, distanceUnit) {
  const totalBonuses = bonus.bonuses.reduce((acc, b) => acc + b.value, 0);
  const base = pay.totalRateValue;
  const tip = pay.tip;

  if (model === 'flat_rate') {
    const total = base + tip + totalBonuses + pay.distanceExpenseAllowance;
    return {
      model: 'flat_rate',
      base_pay: base,
      tip,
      bonuses: bonus.bonuses,
      distance_allowance: pay.distanceExpenseAllowance,
      total,
      currency: sample.currency,
      currency_symbol: sample.currency_symbol,
      includes_tip: tip > 0,
    };
  }
  if (model === 'distance_based') {
    const distance = distanceUnit === 'miles' ? sample.distance_miles : sample.distance_km;
    const perUnit = 95;
    const distancePay = Math.round(perUnit * distance);
    const total = distancePay + tip + totalBonuses;
    return {
      model: 'distance_based',
      base_pay: distancePay,
      per_unit: perUnit,
      distance,
      distance_unit: distanceUnit,
      tip,
      bonuses: bonus.bonuses,
      total,
      currency: sample.currency,
      currency_symbol: sample.currency_symbol,
      includes_tip: tip > 0,
    };
  }
  if (model === 'surge') {
    const multiplier = 1.3;
    const surgeAmount = Math.round(base * (multiplier - 1));
    const total = base + surgeAmount + tip + totalBonuses;
    return {
      model: 'surge',
      base_pay: base,
      surge_amount: surgeAmount,
      multiplier,
      tip,
      bonuses: bonus.bonuses,
      total,
      currency: sample.currency,
      currency_symbol: sample.currency_symbol,
      includes_tip: tip > 0,
    };
  }
  if (model === 'tips_prediction') {
    const predictedMin = 100;
    const predictedMax = 250;
    const total = base + totalBonuses + Math.round((predictedMin + predictedMax) / 2);
    return {
      model: 'tips_prediction',
      base_pay: base,
      predicted_tip_range: [predictedMin, predictedMax],
      bonuses: bonus.bonuses,
      total_estimate: total,
      currency: sample.currency,
      currency_symbol: sample.currency_symbol,
      includes_tip: false,
    };
  }
  throw new Error(`unknown earnings model: ${model}`);
}

function buildData(layout, sample, earnings, bonus, distanceUnit) {
  const data = {};
  const has = (id) => layout.includes(id);

  if (has('route_map')) {
    const [pickup, delivery] = sample.stops;
    data.route_map = {
      pickup: { lat: pickup.lat, lng: pickup.lng, name: pickup.name },
      delivery: { lat: delivery.lat, lng: delivery.lng, name: delivery.name },
    };
  }
  if (has('earnings_total') || has('earnings_total_v2') || has('earnings_breakdown')) {
    data.earnings = earnings;
  }
  if (has('distance_summary')) {
    const value = distanceUnit === 'miles' ? sample.distance_miles : sample.distance_km;
    const unit = distanceUnit === 'miles' ? 'mi' : 'km';
    data.distance_summary = {
      value,
      unit,
      stops: sample.stops.length,
      display: `${value} ${unit} · ${sample.stops.length} stops`,
    };
  }
  if (has('stop_details')) {
    data.stop_details = { stops: sample.stops };
  }
  if (has('navigation_cta')) {
    data.navigation_cta = { label: 'Navigate to business', destination: sample.stops[0] };
  }
  if (has('customer_note')) {
    const deliver = sample.stops.find((s) => s.type === 'DELIVER') || sample.stops[1];
    data.customer_note = { customer_name: deliver?.name ?? 'Customer', note_text: sample.customer_note };
  }
  if (has('acceptance_rate')) {
    data.acceptance_rate = {
      current: bonus.topUpPromotion.currentAcceptanceRate,
      required: bonus.topUpPromotion.requiredAcceptanceRate,
    };
  }
  if (has('accept_cta')) {
    const expiresIn = 40;
    data.accept_cta = {
      countdown_seconds: expiresIn,
      expiration_timestamp: Date.now() + expiresIn * 1000,
    };
  }
  if (has('surge_indicator') && earnings.model === 'surge') {
    data.surge_indicator = {
      multiplier: earnings.multiplier,
      zone: 'Downtown',
      expires_in_seconds: 30,
    };
  }
  if (has('tip_prediction') && earnings.model === 'tips_prediction') {
    data.tip_prediction = {
      range_min: earnings.predicted_tip_range[0],
      range_max: earnings.predicted_tip_range[1],
      confidence: 'high',
    };
  }
  if (has('decline_button')) {
    data.decline_button = { label: 'Decline' };
  }
  return data;
}
