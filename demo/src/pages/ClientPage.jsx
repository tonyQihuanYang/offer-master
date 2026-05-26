import { useEffect, useRef, useState } from 'react';
import OfferRenderer from '../components/offer/OfferRenderer.jsx';
import '../styles/offer.css';

// Event-driven client. Instead of polling for an offer, the courier's "app"
// opens a long-lived SSE stream (the demo's stand-in for the AppSync WebSocket)
// and renders offers as they are *pushed*. The "Dispatch offer" button
// simulates a JobSummaryUpdated event hitting the backend, which assembles the
// payload and pushes it down the stream.
export default function ClientPage() {
  const [tenants, setTenants] = useState([]);
  const [tenant, setTenant] = useState('CA');
  const [courierId, setCourierId] = useState('c123');
  const [variantOverride, setVariantOverride] = useState('auto'); // auto | control | treatment
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState('connecting'); // connecting | connected | reconnecting
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants))
      .catch(() => setTenants(['PL', 'UK', 'CA']));
  }, []);

  // Open (and re-open on courierId change) the SSE stream for this courier.
  useEffect(() => {
    setStatus('connecting');
    setPayload(null);
    const es = new EventSource(`/api/stream?courierId=${encodeURIComponent(courierId)}`);
    esRef.current = es;

    es.addEventListener('connected', () => setStatus('connected'));
    es.addEventListener('offer', (e) => {
      const data = JSON.parse(e.data);
      setPayload(data);
      const a = data.experiment?.assignments ? Object.values(data.experiment.assignments)[0] : null;
      setLog((l) =>
        [{ at: Date.now(), tenant: data.tenant, variant: a?.variant, source: a?.source }, ...l].slice(0, 12),
      );
    });
    es.onopen = () => setStatus('connected');
    es.onerror = () => setStatus('reconnecting');

    return () => es.close();
  }, [courierId]);

  async function dispatch() {
    setError(null);
    try {
      const body = { tenant, courierId };
      if (variantOverride !== 'auto') body.forceVariant = variantOverride;
      const r = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d.delivered) {
        setError('Dispatched, but no open stream received it — is the connection live?');
      }
    } catch (e) {
      setError(String(e));
    }
  }

  const assignment = payload?.experiment?.assignments
    ? Object.entries(payload.experiment.assignments)[0]
    : null;

  const statusColor =
    status === 'connected' ? 'var(--ok, #16a34a)' : status === 'connecting' ? '#d97706' : 'var(--danger)';

  return (
    <div className="page">
      <div className="client-grid">
        <div className="panel">
          <h2>Controls</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
              <span className="muted" style={{ fontSize: 12 }}>
                SSE stream: <strong style={{ color: statusColor }}>{status}</strong> · courier <code>{courierId}</code>
              </span>
            </div>

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
                Changing this re-opens the stream. Same courier always resolves to the same variant (sticky hash).
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
                <code>auto</code> uses the deterministic hash; the others force a variant.
              </div>
            </div>
            <div>
              <button className="primary" onClick={dispatch} disabled={status !== 'connected'}>
                ⚡ Dispatch offer (simulate event)
              </button>
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Simulates a <code>JobSummaryUpdated</code> event → backend assembles → pushes down the stream.
              </div>
            </div>
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

            <div style={{ marginTop: 6 }}>
              <label>Event log</label>
              <div className="event-log">
                {log.length === 0 && <div className="muted" style={{ fontSize: 11 }}>No events yet — hit Dispatch.</div>}
                {log.map((e, i) => (
                  <div key={i} className="event-row">
                    <span className="muted">{new Date(e.at).toLocaleTimeString()}</span>
                    <span>{e.tenant}</span>
                    <span className={`tag ${e.variant}`}>{e.variant}</span>
                    <span className="muted">{e.source}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="phone-frame">
            <div className="phone-screen">
              {payload ? (
                <OfferRenderer payload={payload} />
              ) : (
                <div className="waiting">
                  <div className="waiting-pulse" />
                  <div className="muted">Waiting for an offer…</div>
                  <div className="muted" style={{ fontSize: 11 }}>Press “Dispatch offer”.</div>
                </div>
              )}
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
