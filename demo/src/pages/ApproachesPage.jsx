import { useEffect, useState } from 'react';
import OfferRenderer from '../components/offer/OfferRenderer.jsx';
import ApproachA from '../components/offer/ApproachA.jsx';
import ApproachB from '../components/offer/ApproachB.jsx';
import '../styles/offer.css';

// Side-by-side A vs B vs C: the SAME offer, three ways. The point is to SEE
// that each approach puts a different shape on the wire and moves the logic to
// a different place.
export default function ApproachesPage() {
  const [tenants, setTenants] = useState([]);
  const [tenant, setTenant] = useState('CA');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants))
      .catch(() => setTenants(['CH', 'UK', 'CA']));
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    fetch(`/api/approaches/${tenant}?courierId=c123`)
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [tenant]);

  const columns = [
    {
      key: 'A',
      title: 'A · Template / DSL',
      tag: 'Server renders strings',
      whatChanges: 'Change anything → edit the SERVER (no app release). But mobile can\'t format, animate, or go native.',
      wire: data?.A?.rendered,
      render: data?.A ? <ApproachA payload={data.A} /> : null,
    },
    {
      key: 'B',
      title: 'B · Raw data + mobile',
      tag: 'Mobile owns everything',
      whatChanges: 'Change layout/format → edit the CLIENT code + ship an app release. Native UX, but experiments are slow.',
      wire: data?.B ? { data: data.B.data, flags: data.B.flags } : null,
      render: data?.B ? <ApproachB payload={data.B} /> : null,
    },
    {
      key: 'C',
      title: 'C · Hybrid ✅',
      tag: 'Server: what+order · Mobile: how',
      whatChanges: 'Reorder/show-hide → server config (no release). Mobile formats natively. New component type → release (rare).',
      wire: data?.C?.payload ? { layout: data.C.payload.layout, data: data.C.payload.data } : null,
      render: data?.C?.payload ? <OfferRenderer payload={data.C.payload} /> : null,
    },
  ];

  return (
    <div className="page">
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Same offer, three approaches</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Watch the <b>wire payload</b> change: A sends finished strings, B sends raw data + flags, C sends a layout + raw data.
          That difference = <b>where the logic lives</b>.
        </div>
        <label>Tenant</label>{' '}
        <select value={tenant} onChange={(e) => setTenant(e.target.value)}>
          {tenants.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      </div>

      <div className="approach-grid">
        {columns.map((c) => (
          <div key={c.key} className="panel approach-col">
            <h3 style={{ margin: '0 0 2px' }}>{c.title}</h3>
            <div className="muted" style={{ fontSize: 11, marginBottom: 10 }}>{c.tag}</div>

            <div className="phone-frame phone-frame-mini">
              <div className="phone-screen">{c.render || <div className="muted">Loading…</div>}</div>
            </div>

            <div className="approach-note">{c.whatChanges}</div>

            <details style={{ marginTop: 8 }}>
              <summary>What's on the wire (server → mobile)</summary>
              <pre className="json" style={{ marginTop: 6 }}>
                {c.wire ? JSON.stringify(c.wire, null, 2) : '—'}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
