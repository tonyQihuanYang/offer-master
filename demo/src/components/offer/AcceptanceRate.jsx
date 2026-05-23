export default function AcceptanceRate({ data }) {
  const a = data?.acceptance_rate;
  if (!a) return null;
  const pct = Math.max(0, Math.min(100, a.current));
  const required = Math.max(0, Math.min(100, a.required));
  return (
    <div className="acceptance-rate">
      <div className="label">Your acceptance rate: {pct}%</div>
      <div className="bar">
        <div className="fill" style={{ width: `${pct}%` }} />
        <div className="threshold" style={{ left: `${required}%` }} />
      </div>
      <div className="threshold-label">{required}%</div>
    </div>
  );
}
