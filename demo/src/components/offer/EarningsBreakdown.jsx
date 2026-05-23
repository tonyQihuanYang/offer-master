import { formatMoney, formatRange } from './format.js';

export default function EarningsBreakdown({ data, hints }) {
  const e = data?.earnings;
  if (!e) return null;
  const symbol = e.currency_symbol;
  const highlight = hints?.highlight;
  const lines = [];

  if (e.model === 'flat_rate') {
    lines.push({ label: 'Base pay', value: formatMoney(e.base_pay, symbol) });
    if (e.tip > 0) lines.push({ label: 'Tip', value: formatMoney(e.tip, symbol), key: 'tip' });
    if (e.distance_allowance > 0) lines.push({ label: 'Distance allowance', value: formatMoney(e.distance_allowance, symbol) });
    e.bonuses?.forEach((b) =>
      lines.push({ label: `Bonus · ${b.type.replace(/_/g, ' ')}`, value: formatMoney(b.value, symbol) }),
    );
  } else if (e.model === 'distance_based') {
    lines.push({ label: `${e.distance} ${e.distance_unit === 'miles' ? 'mi' : 'km'} × ${formatMoney(e.per_unit, symbol)}`, value: formatMoney(e.base_pay, symbol) });
    if (e.tip > 0) lines.push({ label: 'Tip', value: formatMoney(e.tip, symbol), key: 'tip' });
    e.bonuses?.forEach((b) =>
      lines.push({ label: `Bonus · ${b.type.replace(/_/g, ' ')}`, value: formatMoney(b.value, symbol) }),
    );
  } else if (e.model === 'surge') {
    lines.push({ label: 'Base pay', value: formatMoney(e.base_pay, symbol) });
    lines.push({ label: `Surge ×${e.multiplier}`, value: formatMoney(e.surge_amount, symbol), key: 'surge' });
    if (e.tip > 0) lines.push({ label: 'Tip', value: formatMoney(e.tip, symbol), key: 'tip' });
    e.bonuses?.forEach((b) =>
      lines.push({ label: `Bonus · ${b.type.replace(/_/g, ' ')}`, value: formatMoney(b.value, symbol) }),
    );
  } else if (e.model === 'tips_prediction') {
    lines.push({ label: 'Base pay', value: formatMoney(e.base_pay, symbol) });
    lines.push({
      label: 'Predicted tip',
      value: formatRange(e.predicted_tip_range[0], e.predicted_tip_range[1], symbol),
      key: 'tip',
    });
    e.bonuses?.forEach((b) =>
      lines.push({ label: `Bonus · ${b.type.replace(/_/g, ' ')}`, value: formatMoney(b.value, symbol) }),
    );
  }

  const totalDisplay =
    e.model === 'tips_prediction'
      ? `≈ ${formatMoney(e.total_estimate, symbol)}`
      : formatMoney(e.total, symbol);

  return (
    <div className="earnings-breakdown">
      <div className="total">{totalDisplay}</div>
      <div className="lines">
        {lines.map((l, i) => (
          <div key={i} className={`line ${highlight === l.key ? 'highlight' : ''}`}>
            <span>{l.label}</span>
            <span>{l.value}</span>
          </div>
        ))}
        <div className="line bold">
          <span>Total earnings</span>
          <span>{totalDisplay}</span>
        </div>
      </div>
    </div>
  );
}
