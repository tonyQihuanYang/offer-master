export default function CustomerNote({ data }) {
  const n = data?.customer_note;
  if (!n) return null;
  return (
    <div className="customer-note">
      <div className="label">Note from {n.customer_name}</div>
      <div className="body">{n.note_text}</div>
    </div>
  );
}
