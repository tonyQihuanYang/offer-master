export default function NavigationCta({ data }) {
  const n = data?.navigation_cta;
  if (!n) return null;
  return (
    <button className="navigation-cta" onClick={() => alert('Opening navigation...')}>
      ↗  {n.label}
    </button>
  );
}
