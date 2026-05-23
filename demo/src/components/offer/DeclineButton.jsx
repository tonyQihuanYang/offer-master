export default function DeclineButton() {
  return (
    <button className="decline" onClick={() => alert('Offer declined')}>
      ✕ Decline
    </button>
  );
}
