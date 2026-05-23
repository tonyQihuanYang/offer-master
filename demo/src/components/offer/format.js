// Earnings values from the server are in cents. Convert + format on the client
// (this is the "Hybrid" idea — mobile owns presentation; server sends raw data).

export function formatMoney(cents, symbol = '$') {
  if (cents == null) return '';
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export function formatRange(minCents, maxCents, symbol = '$') {
  return `${formatMoney(minCents, symbol)}–${formatMoney(maxCents, symbol)}`;
}
