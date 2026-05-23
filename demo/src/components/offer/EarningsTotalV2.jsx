import { formatMoney } from './format.js';

// Same `earnings` data as EarningsTotal (v1). Different presentation:
// - shows pay and tip explicitly side-by-side
// - total computed as a stacked sum below
// - if hints.highlight matches a piece, that piece is accented
//
// This is the kind of A/B test you'd run when you hypothesize that explicit
// tip visibility increases acceptance.
export default function EarningsTotalV2({ data, hints }) {
  const e = data?.earnings;
  if (!e) return null;
  const symbol = e.currency_symbol;
  const tip = e.tip ?? 0;
  const base = pickBase(e);
  const total = e.total ?? e.total_estimate ?? 0;
  const highlight = hints?.highlight;

  return (
    <div className="earnings-total-v2">
      <div className="split">
        <div className={`piece ${highlight === 'pay' ? 'accent' : ''}`}>
          <div className="label">Pay</div>
          <div className="value">{formatMoney(base, symbol)}</div>
        </div>
        <div className="plus">+</div>
        <div className={`piece ${highlight === 'tip' ? 'accent' : ''}`}>
          <div className="label">Tip</div>
          <div className="value">{formatMoney(tip, symbol)}</div>
        </div>
      </div>
      <div className="total-row">
        <span className="muted">Total</span>
        <span className="total">{formatMoney(total, symbol)}</span>
      </div>
    </div>
  );
}

function pickBase(e) {
  if (e.model === 'surge') return (e.base_pay ?? 0) + (e.surge_amount ?? 0);
  if (e.model === 'tips_prediction') return e.base_pay ?? 0;
  return e.base_pay ?? 0;
}
