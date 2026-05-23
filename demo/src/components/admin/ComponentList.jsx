import { useRef, useState } from 'react';

const ALL_COMPONENTS = [
  'route_map',
  'earnings_total',
  'earnings_total_v2',
  'earnings_breakdown',
  'distance_summary',
  'stop_details',
  'navigation_cta',
  'customer_note',
  'acceptance_rate',
  'accept_cta',
  'decline_button',
  'surge_indicator',
  'tip_prediction',
];

// Editable, ordered list of components for one variant. Drag to reorder. Toggle
// to add/remove. The list passed in (`value`) is the ordered enabled subset;
// we render it on top, then list disabled components below as "Add".
export default function ComponentList({ value, onChange }) {
  const enabled = value;
  const disabled = ALL_COMPONENTS.filter((c) => !enabled.includes(c));

  const [draggingIdx, setDraggingIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const dragImgRef = useRef(null);

  function move(from, to) {
    if (from === to || from == null || to == null) return;
    const next = [...enabled];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  }

  function remove(name) {
    onChange(enabled.filter((c) => c !== name));
  }

  function add(name) {
    onChange([...enabled, name]);
  }

  return (
    <div>
      <div className="component-list">
        {enabled.map((name, idx) => (
          <div
            key={name}
            className={`component-row ${draggingIdx === idx ? 'dragging' : ''} ${overIdx === idx ? 'over' : ''}`}
            draggable
            onDragStart={(e) => {
              setDraggingIdx(idx);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(idx));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverIdx(idx);
            }}
            onDragLeave={() => setOverIdx(null)}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData('text/plain'));
              move(from, idx);
              setDraggingIdx(null);
              setOverIdx(null);
            }}
            onDragEnd={() => {
              setDraggingIdx(null);
              setOverIdx(null);
            }}
          >
            <span className="drag-handle">≡</span>
            <span className="name">{name}</span>
            <button className="ghost" onClick={() => remove(name)}>Remove</button>
          </div>
        ))}
        <div ref={dragImgRef} />
      </div>

      {disabled.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h2 style={{ fontSize: 12, margin: '0 0 8px', color: 'var(--text-dim)' }}>Available</h2>
          <div className="component-list">
            {disabled.map((name) => (
              <div key={name} className="component-row disabled">
                <span className="name">{name}</span>
                <button className="ghost" onClick={() => add(name)}>Add</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
