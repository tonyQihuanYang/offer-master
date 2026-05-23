import { useEffect, useState } from 'react';
import ComponentList from '../components/admin/ComponentList.jsx';
import HintsEditor from '../components/admin/HintsEditor.jsx';
import PhonePreview from '../components/admin/PhonePreview.jsx';
import '../styles/offer.css';

const EARNINGS_MODELS = ['flat_rate', 'distance_based', 'surge', 'tips_prediction'];
const DISTANCE_UNITS = ['km', 'miles'];

export default function AdminPage() {
  const [tenants, setTenants] = useState([]);
  const [tenant, setTenant] = useState('CA');
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('control');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/tenants')
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants))
      .catch(() => setTenants(['CH', 'UK', 'CA']));
  }, []);

  useEffect(() => {
    setConfig(null);
    setError(null);
    fetch(`/api/config/${tenant}`)
      .then((r) => r.json())
      .then(setConfig)
      .catch((e) => setError(String(e)));
  }, [tenant]);

  const variant = config?.variants?.[activeTab];

  function updateVariant(patch) {
    setConfig((c) => ({
      ...c,
      variants: { ...c.variants, [activeTab]: { ...c.variants[activeTab], ...patch } },
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/config/${tenant}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSavedAt(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="admin-grid">
        <div className="panel">
          <h2>Tenant</h2>
          <div className="row">
            <select value={tenant} onChange={(e) => setTenant(e.target.value)}>
              {tenants.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {config && (
            <>
              <h2 style={{ marginTop: 18 }}>Experiment</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <label>experiment_id</label>
                  <div>
                    <input
                      type="text"
                      value={config.experiment_id}
                      onChange={(e) => setConfig({ ...config, experiment_id: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div>
                  <label>treatment %</label>
                  <div className="slider-row">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.treatment_pct}
                      onChange={(e) => setConfig({ ...config, treatment_pct: Number(e.target.value) })}
                    />
                    <span style={{ width: 36, textAlign: 'right' }}>{config.treatment_pct}%</span>
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {config.treatment_pct}% see treatment · {100 - config.treatment_pct}% see control
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="primary" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save config'}
                </button>
                {savedAt && (
                  <div className="muted" style={{ fontSize: 11 }}>
                    Saved at {savedAt.toLocaleTimeString()}
                  </div>
                )}
                {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
              </div>

              <div className="json-collapsible">
                <details>
                  <summary>Show saved config JSON</summary>
                  <pre className="json" style={{ marginTop: 8 }}>{JSON.stringify(config, null, 2)}</pre>
                </details>
              </div>
            </>
          )}
        </div>

        <div className="panel">
          {!config ? (
            <div className="muted">Loading…</div>
          ) : (
            <>
              <div className="variant-tabs">
                {['control', 'treatment'].map((v) => (
                  <button
                    key={v}
                    className={activeTab === v ? 'active' : ''}
                    onClick={() => setActiveTab(v)}
                  >
                    <span className={`tag ${v}`} style={{ marginRight: 8 }}>{v}</span>
                    Edit
                  </button>
                ))}
              </div>

              <h2>Layout (drag to reorder)</h2>
              <ComponentList
                value={variant.layout}
                onChange={(layout) => updateVariant({ layout })}
              />

              <h2 style={{ marginTop: 18 }}>Earnings model</h2>
              <div className="row">
                <select
                  value={variant.earnings_model}
                  onChange={(e) => updateVariant({ earnings_model: e.target.value })}
                >
                  {EARNINGS_MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={variant.distance_unit}
                  onChange={(e) => updateVariant({ distance_unit: e.target.value })}
                >
                  {DISTANCE_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <h2 style={{ marginTop: 18 }}>Hints</h2>
              <HintsEditor value={variant.hints} onChange={(hints) => updateVariant({ hints })} />
            </>
          )}
        </div>

        <div>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Live preview (unsaved edits)
          </h2>
          {config && (
            <div className="preview-pair">
              <PhonePreview
                tenant={tenant}
                variantName="control"
                variant={config.variants.control}
                highlighted={activeTab === 'control'}
              />
              <PhonePreview
                tenant={tenant}
                variantName="treatment"
                variant={config.variants.treatment}
                highlighted={activeTab === 'treatment'}
              />
            </div>
          )}
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Previews update as you edit. Click <b>Save config</b> to persist; the Client page picks up changes on its next fetch.
          </div>
        </div>
      </div>
    </div>
  );
}
