export default function SurgeIndicator({ data }) {
  const s = data?.surge_indicator;
  if (!s) return null;
  return (
    <div className="surge-indicator">
      <span>⚡ {s.multiplier}× surge · {s.zone}</span>
      {s.expires_in_seconds != null && <span>{s.expires_in_seconds}s</span>}
    </div>
  );
}
