export default function DistanceSummary({ data }) {
  const d = data?.distance_summary;
  if (!d) return null;
  return <div className="distance-summary">{d.display}</div>;
}
