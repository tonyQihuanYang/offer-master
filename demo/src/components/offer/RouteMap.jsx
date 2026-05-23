export default function RouteMap({ data }) {
  if (!data) return null;
  return (
    <div className="route-map">
      <div className="pin" style={{ left: '20%', top: '40%' }}>A</div>
      <div className="line" style={{ left: '24%', top: '52%', width: '52%', transform: 'rotate(-8deg)' }} />
      <div className="pin" style={{ right: '20%', top: '60%' }}>B</div>
      <div className="label">{data.delivery?.name || 'Destination'}</div>
    </div>
  );
}
