import { formatMoney } from './format.js';

// Approach B renderer — the CLIENT owns everything.
// The server sent only raw data + flags. ALL the composition decisions (which
// widgets, in what order) and ALL the formatting live HERE in the client.
// To change the layout you change THIS code and ship an app release.
export default function ApproachB({ payload }) {
  const d = payload?.data;
  const f = payload?.flags || {};
  if (!d) return null;

  return (
    <div className="offer ab-offer">
      {/* client decides earnings presentation from a flag */}
      {f.earnings_style === 'breakdown' ? (
        <div className="ab-amount">
          {formatMoney(d.base_pay, d.currency_symbol)} + {formatMoney(d.tip, d.currency_symbol)}
        </div>
      ) : (
        <div className="ab-amount">{formatMoney(d.total, d.currency_symbol)}</div>
      )}

      {/* client decides whether to show the tip line */}
      {d.includes_tip && <div className="ab-sub">Includes tip</div>}

      {/* client formats distance + counts stops itself */}
      <div className="muted ab-muted">
        {d.distance} {d.unit} · {d.stops?.length} stops
      </div>

      {/* client builds the stop rows */}
      {d.stops?.map((s, i) => (
        <div key={i} className="ab-row">
          {s.type === 'COLLECT' ? '🏪' : '🏠'} {s.name}
        </div>
      ))}

      {/* client decides whether to show surge from a flag */}
      {f.show_surge && <div className="surge-indicator">⚡ Surge active</div>}

      <button className="accept-cta">Accept offer</button>
    </div>
  );
}
