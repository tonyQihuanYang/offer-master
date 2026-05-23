import { Router } from 'express';
import { fnv1a32 } from '../lib/hash.js';

export const courierBonusRouter = Router();

// Mock Courier Bonus + acceptance rate (folded in for demo simplicity — see PLAN.md)
courierBonusRouter.get('/:courierId', (req, res) => {
  const { courierId } = req.params;
  // Deterministic-ish jitter so different couriers vary slightly
  const seed = fnv1a32(courierId);
  const acceptance = 40 + (seed % 50); // 40..89

  res.json({
    courierId,
    bonuses: [
      { type: 'peak_hour', value: 100 },
      { type: 'consecutive_delivery', value: 50 },
    ],
    topUpPromotion: {
      currentAcceptanceRate: acceptance,
      requiredAcceptanceRate: 80,
      showAcceptanceRate: true,
    },
  });
});
