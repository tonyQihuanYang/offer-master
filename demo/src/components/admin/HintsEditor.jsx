export default function HintsEditor({ value, onChange }) {
  const entries = Object.entries(value);
  function setKey(idx, newKey) {
    const next = entries.slice();
    next[idx] = [newKey, next[idx][1]];
    onChange(Object.fromEntries(next));
  }
  function setVal(idx, newVal) {
    const next = entries.slice();
    next[idx] = [next[idx][0], newVal];
    onChange(Object.fromEntries(next));
  }
  function remove(idx) {
    const next = entries.slice();
    next.splice(idx, 1);
    onChange(Object.fromEntries(next));
  }
  function add() {
    onChange({ ...value, '': '' });
  }
  return (
    <div>
      {entries.map(([k, v], idx) => (
        <div className="hint-row" key={idx}>
          <input
            type="text"
            placeholder="key"
            value={k}
            onChange={(e) => setKey(idx, e.target.value)}
          />
          <input
            type="text"
            placeholder="value"
            value={v}
            onChange={(e) => setVal(idx, e.target.value)}
          />
          <button className="ghost" onClick={() => remove(idx)}>×</button>
        </div>
      ))}
      <button className="ghost" onClick={add} style={{ marginTop: 4 }}>+ Add hint</button>
    </div>
  );
}
