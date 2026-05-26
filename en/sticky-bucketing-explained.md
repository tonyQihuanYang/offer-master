# Sticky A/B Bucketing — `hash(courierId + experimentId) % 100 < treatment_pct`, explained

> How the UC1 Experiment Resolver decides whether a courier sees treatment or control.
> Common interview follow-up: **"How do you guarantee the same courier doesn't flip buckets? Does it survive a cache eviction or a server restart?"**
> One-line answer: **The bucket is *computed*, not *stored*. A deterministic hash means the same input always produces the same output — so it's sticky without any state.**
>
> Code: [`demo/server/lib/hash.js`](../demo/server/lib/hash.js)
> Design: [`hybrid-end-to-end-design.md`](./hybrid-end-to-end-design.md) (Stickiness section)
> Chinese version: [`../study-notes/sticky-bucketing-explained.md`](../study-notes/sticky-bucketing-explained.md)

---

## 1. The problem we're solving

A/B experiments require: **the same courier lands in the same bucket every time** they open the app (always treatment, or always control). Otherwise:

- Inconsistent UX (the breakdown appears one minute, vanishes the next)
- Polluted experiment data (the same user counted in both arms)

The naive solution is to **store a table** `courier_id → variant`. But that requires maintaining state, hitting a database (one extra I/O on the 200ms / 2M-per-hour hot path), and a cache miss could flip a courier between variants.

**A better way: don't store it — just compute it.**

---

## 2. Walking through the formula

```
hash( courierId + experimentId ) % 100 < treatment_pct
└──────────┬──────────┘  └─┬─┘  └────┬────┘
   ① deterministic hash   ② squash    ③ threshold compare
                          into 0-99
```

Concrete example — courier `courier_8423`, experiment `earnings_v2`, `treatment_pct = 10` (10% rollout):

| Step | Operation | Result | What it does |
|---|---|---|---|
| ① concat | `"courier_8423::earnings_v2"` | a string | combine courierId + experimentId |
| ② hash | `fnv1a32(...)` | `2891749223` | **deterministic** — same input, same output every time; flip one character and the result changes completely (avalanche effect) |
| ③ `% 100` | `2891749223 % 100` | `23` | squash a large integer into **0–99**, roughly uniformly distributed (each courier gets a stable "lottery number") |
| ④ `< 10` | `23 < 10` | `false` | only numbers 0–9 go into treatment → this courier is **control** |

> **The lottery number (0–99) is the key intermediate value** — it's fixed forever for a given courier.
> `treatment_pct` is just a moving threshold ("anyone below this number is treatment").

---

## 3. Why this is sticky *without state*

The bucket isn't **remembered** — it's **recomputed from courierId every time**.

```
Request 1 → hash("courier_8423::earnings_v2") % 100 = 23 → control
Request 2 → hash("courier_8423::earnings_v2") % 100 = 23 → control   ← must be identical
Request N → hash("courier_8423::earnings_v2") % 100 = 23 → control
```

Because hash is a **pure (deterministic) function**:

- ✅ **Cache eviction can't flip anyone** — the bucket isn't *in* the cache. The cache only holds flag config (the value of `treatment_pct`); it never holds "who is in which bucket"
- ✅ **Server restart or moving to a new machine doesn't flip anyone** — any machine computing `courier_8423` gets `23`
- ✅ **No DB lookup, no extra I/O** — just an in-memory computation on the hot path, sub-millisecond

This is exactly what the interviewer wants to hear: **"Cache eviction does not flip a courier, because the bucket is recomputed from a stable hash, not stored."**

---

## 4. Why ramping (rollout) never "kicks people out"

Ramping = changing `treatment_pct`, e.g. from 10 → 50:

```
treatment_pct = 10:  buckets 0──9  treatment │ 10────────99 control
treatment_pct = 50:  buckets 0───────────49  treatment │ 50──99 control
                     └ 0-9 already in, kept in ┘ └ newly added: 10-49 ┘
```

Using `<` (or `<=`) **with the same hash**, ramping **only adds couriers, never removes them** (monotonicity).
- Couriers with lottery numbers 0–9: `<10` true, `<50` also true → stay in treatment, **don't flip**
- Couriers with lottery numbers 10–49: move from control into treatment (the expected new entrants)

⚠️ Counter-example: if you change the hash function / change the concatenation order / use random numbers → every lottery number changes → couriers previously in treatment may get kicked back to control → **experiment data is invalidated**. So **the hash function and concat rule must never change after launch.**

---

## 5. Why `+ experimentId` matters

It makes each experiment **bucket independently (de-correlated)**.

```
courierId only:                  courierId + experimentId:
exp_A: courier_8423 → 23          exp_A: "courier_8423::exp_A" → 23
exp_B: courier_8423 → 23          exp_B: "courier_8423::exp_B" → 71   ← different
exp_C: courier_8423 → 23          exp_C: "courier_8423::exp_C" → 5
  ↑ The same cohort lands in       ↑ Buckets are independent across
    treatment for every experiment   experiments
    → correlated samples, biased
```

Adding experimentId makes a courier's bucket assignment in different experiments mutually independent, avoiding systematic bias from "the same cohort always being the guinea pigs."

---

## 6. Eligibility vs Bucketing — don't conflate the two layers

| Layer | What it decides | Keyed on | Example |
|---|---|---|---|
| **Eligibility gate** | **Who's allowed into the experiment** | region / city / % rollout | "ramp up in Toronto first" |
| **Bucket assignment** | Once they're in, **treatment or control** | **must be a stable `courierId`** | `hash(courierId+expId)%100` |

⚠️ Pitfall: **Never key the bucket on region** — a courier crossing a region boundary or having their region updated will flip.
Region is only for *eligibility* (who gets in). **Once they're in, the bucket is always computed from `courierId`.**

---

## 7. Fail-closed (what if you can't compute it?)

```
resolve(courierId, experimentId):
    if courierId missing / flag service error / timeout:
        return control          ← default to control; never error, never hang
    bucket = hash(courierId + experimentId) % 100
    return bucket < treatment_pct ? treatment : control
```

If a dependency is slow or down, we **degrade the experiment** (fall back to control), **without affecting the offer itself**. Alarm if the fallback fires above ~1%.

---

## 8. The code (what the demo actually runs)

```js
// demo/server/lib/hash.js
export function fnv1a32(str) {
  let h = 0x811c9dc5;                       // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);                 // XOR the current byte
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; // ×FNV prime
  }
  return h >>> 0;                           // convert to unsigned 32-bit
}

export function bucket(courierId, experimentId) {
  return fnv1a32(`${courierId}::${experimentId}`) % 100;   // → 0–99
}
```

> **FNV-1a** is used here only because it's zero-dependency, fast, and has a good enough distribution for bucketing.
> MurmurHash / xxHash work equally well in production — **the key isn't which hash, it's "deterministic + uniformly distributed + never changed after launch."**

---

## 9. Q&A — multi-arm experiments & collisions

> Sections 1–8 covered the **two-arm** split (treatment vs control). Real experiments often have
> more than two arms, and you may run several experiments at once — that raises the
> "can one courier be in two buckets?" question.

---

**Q: With two arms it's `< treatment_pct`. How does the same hash handle *three* arms — say control / v1 / v2?**

A: Same single hash, just **multiple thresholds** over the 0–99 number. One courier gets one number, so they land in exactly one band:

```
bucket = hash(courierId + "earnings_display") % 100      // one number, e.g. 23
  0–33   → control
  34–66  → earnings_v1
  67–99  → earnings_v2
```

The point: **with one experimentId, mutual exclusion between arms is structural** — a courier gets one number, that number falls in one band, so they can never see two arms at once. No coordination needed.

---

**Q: Now suppose `earnings_v1` and `earnings_v2` are *separate* experiments. Can the same courier be in the treatment bucket of both?**

A: **It depends on whether they're one experiment or two — that's the whole answer.**

- **Two arms of *one* experiment** (same `experimentId`, e.g. `"earnings_display"`): No. One hash → one number → one band. Overlap is impossible *by construction*.
- **Two *separate* experiments** (different `experimentId`, `"earnings_v1"` and `"earnings_v2"`): **Yes, mathematically a courier can be treatment in both** — because we deliberately hash on `courierId + experimentId` to **de-correlate** experiments:

```
bucket_v1 = hash(courierId + "earnings_v1") % 100  → 23 → treatment
bucket_v2 = hash(courierId + "earnings_v2") % 100  → 71 → treatment
```

That de-correlation is a **feature** for independent experiments (one changes earnings, another changes the map pin) and a **bug** if both experiments render the *same surface* — the courier would get conflicting instructions for one screen. This is called an **experiment collision**.

---

**Q: So how do you prevent a collision when two experiments touch the same surface?**

| Approach | How | When to use |
|---|---|---|
| **Model as one experiment** (preferred) | Put the competing variants as **arms of a single `experimentId`** (the 3-arm split above) | v1 / v2 are opposing presentations of the *same* screen |
| **Mutual-exclusion group / layer** | Assign experiments that share a surface to one **exclusion group**: hash to pick *which* experiment in the group first, then bucket within it — a courier joins at most one experiment per group | Multiple experiments compete for the same area long-term (cf. Google "layers", Optimizely exclusion groups) |
| **Priority / holdout** | The resolver serves only the **highest-priority eligible** experiment for that surface and ignores the rest | Temporary overlap with a clear precedence |

**Speakable version:**

> "If v1 and v2 are two arms of *one* experiment, the single hash puts each courier in exactly one band — overlap is impossible by construction. If they're two *separate* experiments on the same surface, then yes — the very `+ experimentId` de-correlation that's *desirable* for independent experiments lets a courier land in treatment for both, which is a collision. I'd prevent it by modeling competing variants as one multi-arm experiment, or with **mutual-exclusion groups** for experiments that share a surface."

---

## 🗣️ Speakable interview answer (memorize this)

> "Assignment is **deterministic, not stored**. We take `hash(courierId + experimentId) % 100` — that gives each courier a stable number 0–99 — and compare it to `treatment_pct`. Same courier, same experiment, **always the same bucket**, because it's a pure function of a stable ID.
>
> So a **cache eviction or server restart can't flip anyone** — there's no per-courier state to lose; we recompute it every time, sub-millisecond, no DB lookup.
>
> **Ramping is monotonic**: going 10% → 50% only *adds* couriers to treatment, never removes the ones already in it, because we keep the same hash and just raise the threshold.
>
> We hash on `courierId + experimentId` so **experiments de-correlate** — otherwise the same couriers always land in treatment across every experiment, which biases the results.
>
> Region only gates **eligibility** — who's *allowed* in. The **bucket** is always keyed on the stable courierId, so a courier changing region never flips their variant. And we **fail closed**: if we can't resolve, the courier gets control — a slow flag service degrades the experiment, never the offer."

---

## Related

- [`hybrid-end-to-end-design.md`](./hybrid-end-to-end-design.md) — Stickiness / end-to-end design
- [`../demo/server/lib/hash.js`](../demo/server/lib/hash.js) — the actual bucketing code
- [`../adr/ADR-001-hybrid-sdui.en.md`](../adr/ADR-001-hybrid-sdui.en.md) — decision record (Experiment Resolver)
