import { useEffect, useRef, useState } from 'react';
import OfferRenderer from '../offer/OfferRenderer.jsx';

// Calls POST /api/offer/:tenant/preview whenever `variant` changes (debounced).
// Renders the result inside a phone frame. Used by the Admin page to show what
// the courier app will look like for the variant being edited.
export default function PhonePreview({ tenant, variantName, variant, highlighted }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!tenant || !variant) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/offer/${tenant}/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variantName, variant }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setPayload(data);
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    }, 120);
    return () => clearTimeout(debounceRef.current);
  }, [tenant, variantName, JSON.stringify(variant)]);

  return (
    <div className={`preview-card ${highlighted ? 'highlighted' : ''}`}>
      <div className="preview-card-header">
        <span className={`tag ${variantName}`}>{variantName}</span>
        {error && <span style={{ color: 'var(--danger)', fontSize: 11 }}>{error}</span>}
      </div>
      <div className="phone-frame phone-frame-mini">
        <div className="phone-screen">
          <OfferRenderer payload={payload} />
        </div>
      </div>
    </div>
  );
}
