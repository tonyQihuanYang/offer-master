export default function StopDetails({ data }) {
  const stops = data?.stop_details?.stops;
  if (!stops?.length) return null;
  const collectCount = stops.filter((s) => s.type === 'COLLECT').length;
  const deliverCount = stops.filter((s) => s.type === 'DELIVER').length;
  return (
    <div className="stop-details">
      {stops.map((s, idx) => {
        const isCollect = s.type === 'COLLECT';
        const headerCount = isCollect ? collectCount : deliverCount;
        const headerLabel = isCollect ? 'pickup' : 'delivery';
        return (
          <div className="stop-row" key={idx}>
            <div className="icon">{isCollect ? '🏠' : '👤'}</div>
            <div className="info">
              <div className="name">
                {headerCount} {headerLabel}: {s.name}
              </div>
              <div className="addr">{s.address}</div>
              <div className="arrive">Arrive at {s.arrive_at}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
