import { useEffect, useState } from 'react';

export default function AcceptCta({ data }) {
  const initial = data?.accept_cta?.countdown_seconds ?? 40;
  const [secondsLeft, setSecondsLeft] = useState(initial);

  useEffect(() => {
    setSecondsLeft(initial);
    const t = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [initial]);

  if (!data?.accept_cta) return null;
  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, '0');
  return (
    <button className="accept-cta" onClick={() => alert('Offer accepted!')}>
      <span>Accept offer</span>
      <span className="timer">{mm}:{ss}</span>
    </button>
  );
}
