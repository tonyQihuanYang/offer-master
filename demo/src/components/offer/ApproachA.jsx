// Approach A renderer — DUMB on purpose.
// The server already rendered the final display (strings). This component does
// ZERO formatting and ZERO decisions: it just paints whatever widgets it's given.
// To change anything (a number, the order, a label) you change the SERVER.
export default function ApproachA({ payload }) {
  if (!payload?.rendered) return null;
  return (
    <div className="offer ab-offer">
      {payload.rendered.map((w, i) => {
        if (!w.text) return null;
        switch (w.widget) {
          case 'amount':
            return <div key={i} className="ab-amount">{w.text}</div>;
          case 'subtitle':
            return <div key={i} className="ab-sub">{w.text}</div>;
          case 'muted':
            return <div key={i} className="muted ab-muted">{w.text}</div>;
          case 'row':
            return <div key={i} className="ab-row">{w.text}</div>;
          case 'cta':
            return <button key={i} className="accept-cta">{w.text}</button>;
          default:
            return <div key={i}>{w.text}</div>;
        }
      })}
    </div>
  );
}
