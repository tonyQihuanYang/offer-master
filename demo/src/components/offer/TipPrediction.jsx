import { formatRange } from './format.js';

export default function TipPrediction({ data }) {
  const t = data?.tip_prediction;
  const e = data?.earnings;
  if (!t) return null;
  const symbol = e?.currency_symbol || '$';
  return (
    <div className="tip-prediction">
      <span>💡 Predicted tip: {formatRange(t.range_min, t.range_max, symbol)}</span>
      <span>{t.confidence}</span>
    </div>
  );
}
