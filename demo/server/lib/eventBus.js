// Tiny in-memory pub/sub for the demo's event-driven path.
//
// This is the local stand-in for the real transport: in production the offer is
// pushed courier → SQS → AppSync (WebSocket). Here a producer (POST /api/dispatch)
// publishes to a key (courierId) and any open SSE connections for that key get
// the offer pushed to them. Producer and consumer are fully decoupled — the
// dispatch endpoint doesn't know or care who is listening.

class EventBus {
  constructor() {
    this.subscribers = new Map(); // key (courierId) → Set<res>
  }

  subscribe(key, res) {
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
    this.subscribers.get(key).add(res);
    return () => {
      const set = this.subscribers.get(key);
      if (!set) return;
      set.delete(res);
      if (set.size === 0) this.subscribers.delete(key);
    };
  }

  // Returns the number of connections the event was delivered to.
  publish(key, type, payload) {
    const set = this.subscribers.get(key);
    if (!set || set.size === 0) return 0;
    const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
    let delivered = 0;
    for (const res of set) {
      res.write(frame);
      delivered += 1;
    }
    return delivered;
  }

  count(key) {
    return this.subscribers.get(key)?.size ?? 0;
  }
}

export const bus = new EventBus();
