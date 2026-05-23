import { formatMoney } from './format.js';

export default function EarningsTotal({ data }) {
  const e = data?.earnings;
  if (!e) return null;
  const total = e.total ?? e.total_estimate ?? 0;
  return (
    <div className="earnings-total">
      <div className="amount">{formatMoney(total, e.currency_symbol)}</div>
      {e.includes_tip && <div className="subtitle">Includes tip</div>}
    </div>
  );
}
