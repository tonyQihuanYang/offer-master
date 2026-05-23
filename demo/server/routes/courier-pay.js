import { Router } from 'express';

export const courierPayRouter = Router();

courierPayRouter.get('/:deliveryId', (req, res) => {
  const { deliveryId } = req.params;
  // Mock pay response. Values in cents to match the real Courier Pay style.
  res.json({
    deliveryId,
    totalRateValue: 726,
    tip: 250,
    distanceExpenseAllowance: 50,
  });
});
