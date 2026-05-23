import { useEffect, useState } from 'react';
import OfferRenderer from '../components/offer/OfferRenderer.jsx';
import '../styles/offer.css';

export default function ClientPage() {
  const [tenants, setTenants] = useState([]);
  const [tenant, setTenant] = useState('CA');
  const [courierId, setCourierId] = useState('c123');
  const [variantOverride, setVariantOverride] = useState('auto'); // auto | control | treatment
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants))
      .catch(() => setTenants(['CH', 'UK', 'CA']));
  }, []);

  async function fetchOffer() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ courierId });
      if (variantOverride !== 'auto') params.set('forceVariant', variantOverride);
      const r = await fetch(`/api/offer/${tenant}?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setPayload(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch on parameter change
  useEffect(() => {
    fetchOffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, courierId, variantOverride]);

  const assignment = payload?.experiment?.assignments
    ? Object.entries(payload.experiment.assignments)[0]
    : null;

  return (
    <div className="page">
      <div className="client-grid">
        <div className="panel">
          <h2>Controls</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label>Tenant</label>
              <div>
                <select value={tenant} onChange={(e) => setTenant(e.target.value)}>
                  {tenants.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label>Courier ID</label>
              <div>
                <input
                  type="text"
                  value={courierId}
                  onChange={(e) => setCourierId(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Same courier always resolves to the same variant (sticky hash).
              </div>
            </div>
            <div>
              <label>Variant</label>
              <div className="variant-tabs">
                {['auto', 'control', 'treatment'].map((v) => (
                  <button
                    key={v}
                    className={variantOverride === v ? 'active' : ''}
                    onClick={() => setVariantOverride(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="muted" style={{ fontSize: 11 }}>
                <code>auto</code> uses the deterministic hash; the others force a preview.
              </div>
            </div>
            <div>
              <button className="primary" onClick={fetchOffer} disabled={loading}>
                {loading ? 'Fetching…' : 'Fetch offer'}
              </button>
            </div>
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
          </div>
        </div>

        <div>
          <div className="phone-frame">
            <div className="phone-screen">
              <OfferRenderer payload={payload} />
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Payload Inspector</h2>
          {assignment && (
            <div className="assignment-block">
              <div className="row">
                <span className="muted">experiment</span>
                <span>{assignment[0]}</span>
              </div>
              <div className="row">
                <span className="muted">variant</span>
                <span className={`tag ${assignment[1].variant}`}>{assignment[1].variant}</span>
              </div>
              <div className="row">
                <span className="muted">bucket</span>
                <span>{assignment[1].bucket} / 100</span>
              </div>
              <div className="row">
                <span className="muted">rollout</span>
                <span>{assignment[1].rolloutPct}% treatment</span>
              </div>
              <div className="row">
                <span className="muted">source</span>
                <span>{assignment[1].source}</span>
              </div>
            </div>
          )}
          <pre className="json">{payload ? JSON.stringify(payload, null, 2) : '—'}</pre>
        </div>
      </div>
    </div>
  );
}
