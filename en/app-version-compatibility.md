# App Version Compatibility & Mobile Rollouts

How to evolve the offer payload contract when some couriers run an old version
of the mobile app and some run a new one. Companion to
[`hybrid-end-to-end-design.md`](./hybrid-end-to-end-design.md).

> **Scope.** This document covers the *contract* between
> `courier_offer_service` (server) and the iOS/Android app (client) — what
> data the server sends, when, and how the client copes with payloads it
> doesn't fully understand. It does not cover server-to-server changes
> upstream of `courier_offer_service`.

---

## The core principle

**Backward compatibility is owned by the server. Forward compatibility is
owned by the client.**

- The server keeps speaking the old contract for as long as old apps exist.
  It can *additively* speak new contracts to new apps.
- The client (mobile) handles unknown things gracefully — unknown component
  names skipped, unknown fields ignored.

Combined, these two properties mean the server can introduce new things
without coordinating with mobile, and mobile can ship new things without
breaking when the server hasn't caught up.

---

## The four change types

Every change to the payload contract falls into one of four buckets. Only
type 3 is genuinely hard.

| Type | Example | How to handle |
|---|---|---|
| **1. Add a new component** (new visual block) | `earnings_total_v3` shows a circular gauge | The hybrid design handles this for free — old apps without `v3` in their REGISTRY skip it silently. Just register the data block on the server when layout includes the new name. |
| **2. Add an optional field** to existing component data | `earnings.vs_weekly_avg_pct: 23` to show "↑ 23% above avg" | JSON parsers ignore unknown fields by default. Old apps see no badge; new apps render it. Zero coordination. |
| **3. Change the *semantics* of an existing field** | `earnings.total` was net pay, now it's gross | **Don't.** Add a new field instead — `earnings.total_net` + `earnings.total_gross`. Or treat it as a new component. The cost of "renaming in place" is always higher than additive change. |
| **4. Remove a field** | Delete `earnings.distance_allowance` | Don't, until old supported versions sunset. Wait for analytics to show <1–2% of couriers on the version that uses it, then drop. |

## Where this gets interesting: case-3 dressed up as case-1

The cleanest way to make a "breaking" change non-breaking is to **make it a
new component**. Same logical concept, new name, new data block:

```js
// Mobile registry
REGISTRY = {
  earnings_total: EarningsTotal,        // reads earnings.total (legacy: net pay)
  earnings_total_v2: EarningsTotalV2,   // reads earnings.total_gross + earnings.total_net
};
```

Old apps know `earnings_total` and read its (legacy) data. New apps know
both, but the layout config decides which to put in the layout. Now the
question becomes: **how does the server know which name to put in the layout
for a given courier's app version?**

That's where app version detection comes in.

---

## App version detection

The server needs to know which version of the mobile app is asking for an
offer so it can emit a layout that app actually understands. Three places it
can come from:

| Source | Pros | Cons |
|---|---|---|
| **HTTP/event header** (`X-App-Version: 5.2.0`) | Simple, direct | Needs the header to be propagated through SQS, AppSync, etc. — currently unverified for our system (see [`handOver.md`](./handOver.md)) |
| **JWT/auth token claim** | Already trusted, signed | Requires re-issuing tokens when version changes — usually fine since logins refresh |
| **Courier profile lookup** | Decoupled from request path | Stale by design (cached); courier might have just upgraded |

The Layout Composer in the production design takes courier context as input.
That's the natural place to plumb `appVersion` through.

> **Open verification item.** We don't yet know which mechanism the courier
> system uses today (or whether it has any). This is item #5 in
> [`handOver.md`](./handOver.md) — confirm with the courier_offer_service
> code and mobile platform leads before designing on top of an assumed
> source.

---

## How the Layout Composer uses app version

Once the server knows the version, the layout config can branch:

```json
{
  "tenant": "CA",
  "experiment_id": "earnings_v2",
  "treatment_pct": 25,
  "variants": {
    "control": {
      "layout": ["route_map", "earnings_total", "accept_cta"]
    },
    "treatment": {
      "layout": ["route_map", "earnings_total_v3", "vs_avg_badge", "accept_cta"],
      "min_app_version": "5.2.0",
      "fallback": {
        "layout": ["route_map", "earnings_total", "accept_cta"]
      }
    }
  }
}
```

Logic in the composer:

```
if (variant.min_app_version && courier.app_version < variant.min_app_version) {
  use variant.fallback;
} else {
  use variant.layout;
}
```

**Key property:** treatment-bucket couriers on old apps automatically get the
fallback (which is usually identical to control). Their experiment
assignment is preserved — they're still "in treatment" for analytics — but
they render the safe layout. When they upgrade, the next offer renders the
real treatment layout.

This is also how you do **silent migrations**: ship the new component to
mobile in version N, but keep the layout config emitting the old component
name. Once N+1 is at >95% adoption, flip the layout config to use the new
component name. Couriers on the laggard versions still get the old layout
via the fallback.

---

## When the change really needs a different data shape

Sometimes new mobile actually needs new data on the wire — a new field, a
new sub-block. Three strategies, in order of complexity:

### Strategy 1: Always-on additive emission

The server emits the new data unconditionally; old apps ignore it. This is
fine when:

- The data is cheap to compute.
- The payload size cost is negligible.
- The data isn't sensitive (you wouldn't want to leak gross earnings to old
  apps that don't ask).

```json
"earnings": {
  "total": 1126,                          // legacy net total — always emitted
  "total_gross": 1326,                    // NEW — old apps ignore
  "total_net": 1126,                      // NEW — old apps ignore
  "deductions": [                         // NEW — old apps ignore
    { "type": "platform_fee", "value": 200 }
  ]
}
```

### Strategy 2: Version-gated emission

The server only emits the new data when the courier's app version supports
it. This is necessary when:

- The data is expensive (extra DB queries, extra service calls).
- At 2M offers/hour, "extra" matters — even 5ms compute × 2M = 10,000
  CPU-seconds/hour.
- The data is sensitive or must not leak.

```js
// In offer assembly
if (courier.app_version >= '5.2.0') {
  earnings.deductions = await fetchDeductions(...);
  earnings.total_gross = computeGross(...);
}
```

### Strategy 3: Dual payload (during migration)

Briefly described in `hybrid-end-to-end-design.md` Phase 2. During migration,
the server emits *both* the old and new shape:

```json
{
  "data":     { ...legacy shape...     },
  "data_v2":  { ...new modular shape... }
}
```

Old apps read `data`, new apps read `data_v2`. Once metrics show new-format
adoption is high enough, drop `data`. This is the safest pattern but doubles
payload size during the transition, so it's bounded in time.

---

## The full mobile rollout playbook

Putting it all together — here's what shipping a new feature actually looks
like end-to-end:

```
T = 0    Server-side dev: add new fields/components, gated on app version.
         Old behavior unchanged. Tests pass against old payload contract.

T = +1d  Mobile-side dev: implement the new component reading the new fields.
         Build app version N+1.

T = +2w  App N+1 ships. Some users upgrade, some don't.
         Server still defaults to old layout. Adoption climbs slowly.

T = +3w  Layout config includes the new component, gated on min_app_version.
         New-app couriers see the new feature. Old-app couriers see the
         fallback (= control layout).
         Begin A/B test: half of N+1 users get the new component, half don't.

T = +6w  N+1 adoption ~90%. A/B test results in. If positive, ramp to 100%
         on N+1.

T = +3mo App N adoption <2%. Stop emitting legacy fields. Drop fallback
         layout. The migration is complete.
```

The key insight: at every step, **at most one of the two app versions sees a
change**. The other version keeps seeing what it saw yesterday. There is no
moment where both old and new apps are forced to handle a new contract
simultaneously.

---

## Summary cheatsheet

> *We modified the FE. Some users upgrade, some don't. We need to send new
> data only for new apps. How?*

1. **Detect app version** server-side (header / token claim / profile).
2. **Make the new feature a new component** (`foo_v2`) with its own data
   block — never overload an old field with new semantics.
3. **Gate the layout** by `min_app_version` per variant. Old apps get the
   fallback (= the same layout couriers in `control` get); new apps get the
   real new layout.
4. **Emit old fields as long as old apps exist.** Stop only when adoption
   analytics say it's safe (typically <1–2%).
5. **For expensive new data**, version-gate the *computation* too — don't
   pay the CPU/IO cost for couriers who can't render it.
6. **For migrations**, the dual-payload pattern (`data` + `data_v2`) is
   heavier but lets you switch any subset of couriers between formats with a
   single flag.

The forward-compat skip behavior (built into the demo) + the Layout Composer
(in the production design) + app version detection (still in `handOver.md`)
is the trio that makes this work cleanly.

---

## Adding app-version awareness to the demo

The demo currently has no notion of app version. To extend it for
demonstration purposes:

1. **Client page (`/client`):** add an `appVersion` input, e.g., a dropdown
   with `5.0.0`, `5.1.0`, `5.2.0`. Pass it as a query param to
   `/api/offer/:tenant`.
2. **Server `/api/offer/:tenant`:** read `appVersion`, pass it to the layout
   resolution.
3. **Layout config:** extend each variant with optional `min_app_version` and
   `fallback`. The composer downgrades if the courier's version is below
   the minimum.

The visible result: changing the App version dropdown on the Client page
would change what the phone renders, even when the variant assignment is
the same — proving that old-version couriers safely fall back to a
compatible layout while still being counted in their assigned variant.

This is roughly a 50-line addition. Out of scope for the current demo, but
straightforward to layer on if desired.

---

## Related documents

- [`hybrid-end-to-end-design.md`](./hybrid-end-to-end-design.md) — the
  production design this document extends.
- [`handOver.md`](./handOver.md) — open verification items, including how
  app version actually flows through `courier_offer_service` today.
- [`approach-evaluation.md`](./approach-evaluation.md) — how Approach A vs
  Hybrid handle versioning differently (Approach A is mostly server-only;
  Hybrid pushes the migration coordination across both sides).
- [`demo/README.md`](../demo/README.md) — the working demo that implements
  the forward-compat skip behavior referenced above.
