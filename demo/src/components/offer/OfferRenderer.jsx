import RouteMap from './RouteMap.jsx';
import EarningsTotal from './EarningsTotal.jsx';
import EarningsTotalV2 from './EarningsTotalV2.jsx';
import EarningsBreakdown from './EarningsBreakdown.jsx';
import DistanceSummary from './DistanceSummary.jsx';
import StopDetails from './StopDetails.jsx';
import NavigationCta from './NavigationCta.jsx';
import CustomerNote from './CustomerNote.jsx';
import AcceptanceRate from './AcceptanceRate.jsx';
import AcceptCta from './AcceptCta.jsx';
import SurgeIndicator from './SurgeIndicator.jsx';
import TipPrediction from './TipPrediction.jsx';
import DeclineButton from './DeclineButton.jsx';

// The component registry. Server-side `layout.components[]` is iterated and
// each name is looked up here. Unknown names render as a small dev-only
// placeholder (the production app would skip them silently).
export const REGISTRY = {
  route_map: RouteMap,
  earnings_total: EarningsTotal,
  earnings_total_v2: EarningsTotalV2,
  earnings_breakdown: EarningsBreakdown,
  distance_summary: DistanceSummary,
  stop_details: StopDetails,
  navigation_cta: NavigationCta,
  customer_note: CustomerNote,
  acceptance_rate: AcceptanceRate,
  accept_cta: AcceptCta,
  surge_indicator: SurgeIndicator,
  tip_prediction: TipPrediction,
  decline_button: DeclineButton,
};

export default function OfferRenderer({ payload }) {
  if (!payload) {
    return <div className="offer"><div className="muted" style={{ padding: 24, textAlign: 'center' }}>No offer yet — click Fetch Offer.</div></div>;
  }
  const { layout, data } = payload;
  const components = layout?.components ?? [];
  const hints = layout?.hints ?? {};
  const urgent = hints.theme === 'urgent';
  return (
    <div className="offer">
      <div className="top-bar"><DeclineButton /></div>
      <div className={`offer-card ${urgent ? 'urgent' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {components.map((name, idx) => {
            const Comp = REGISTRY[name];
            if (!Comp) {
              return (
                <div key={idx} className="unknown-component">
                  unknown component: {name} (skipped on production build)
                </div>
              );
            }
            return <Comp key={`${name}-${idx}`} data={data} hints={hints} />;
          })}
        </div>
      </div>
    </div>
  );
}
