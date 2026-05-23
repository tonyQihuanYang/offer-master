# Demo Plan: Hybrid Offer System (React + Vite + Node)

## Context

Build a working demo showing the hybrid approach for the courier offer system. Two pages:
1. **Admin Page** — developers/product configure offer layouts per tenant **and define A/B variants** (drag-and-drop component order, toggle components, set hints, define control vs treatment)
2. **Client Page** — simulates the courier mobile app offer screen, renders based on admin config **with a variant toggle to preview control vs treatment**

Goals:
- Demonstrate that changing layout config on admin instantly changes what the courier sees — no "app release" needed.
- Demonstrate the second key design dimension: **per-courier A/B variant assignment** (the production design's primary motivation).

## Canonical Component Names

To stay consistent with `hybrid-end-to-end-design.md`, the demo uses these names exactly:

`route_map`, `earnings_total`, `earnings_breakdown`, `distance_summary`, `stop_details`, `navigation_cta`, `customer_note`, `acceptance_rate`, `accept_cta`, `decline_button`, `surge_indicator`, `tip_prediction`, `pooling_info`, `alcohol_warning`, `proof_of_delivery`.

(Older drafts used `distance_info`, `urgency_badge` — those names are dropped.)

---

## Architecture

```
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│  Admin Page (React)             │         │  Client Page (React)            │
│  - Select tenant (CH/UK/CA)     │         │  - Select tenant                │
│  - Edit control variant         │  HTTP   │  - Pick variant: control /      │
│  - Edit treatment variant       │────────▶│    treatment / auto             │
│  - Drag/drop component order    │         │  - Fetches assembled offer      │
│  - Toggle components on/off     │         │  - Dark theme (like real app)   │
│  - Set hints (highlight, theme) │         │  - Mock actions (alert on tap)  │
│  - Set earnings model           │         │  - Shows payload JSON +         │
│  - Save config                  │         │    experiment.assignments       │
└─────────────────────────────────┘         └─────────────────────────────────┘
              │                                          │
              │ POST /api/config/:tenant                 │ GET /api/offer/:tenant?courierId=&variant=
              ▼                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Node/Express Server (simulates 4 services)                                  │
│                                                                              │
│  /api/courier-pay/:deliveryId    ← simulates Courier Pay Service             │
│    → returns { totalRateValue, tip, distanceExpenseAllowance }               │
│                                                                              │
│  /api/courier-bonus/:courierId   ← simulates Courier Bonus Service           │
│    → returns { bonuses[], topUpPromotion, acceptanceRate* }                  │
│    * acceptanceRate is sourced from the courier profile in production;       │
│      mocked here inside bonus to keep the demo to one mock surface.          │
│                                                                              │
│  /api/experiment/:courierId      ← simulates Experiment Resolver             │
│    → deterministic hash(courierId+experimentId) → control | treatment        │
│    → ?variant= override forces a group (for the preview toggle)              │
│                                                                              │
│  /api/offer/:tenant              ← simulates courier_offer_service           │
│    → reads layout config + variants for tenant                               │
│    → resolves variant assignment via /api/experiment                         │
│    → calls courier-pay + courier-bonus internally                            │
│    → applies earnings model for the resolved variant                         │
│    → assembles modular payload (layout + data + hints + experiment)          │
│    → returns final offer to client                                           │
│                                                                              │
│  /api/config/:tenant             ← Admin CRUD for layout configs             │
│  /api/tenants                    ← List available tenants                    │
│                                                                              │
│  Storage: JSON files (configs.json, sample-offers.json)                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### How it maps to the real system

| Real System | Demo Equivalent |
|---|---|
| Courier Pay Service | `/api/courier-pay/:deliveryId` (mock data) |
| Courier Bonus Service | `/api/courier-bonus/:courierId` (mock data) |
| Courier profile / acceptance-rate source | Folded into `/api/courier-bonus` for demo simplicity |
| Experiment Resolver / feature flag service | `/api/experiment/:courierId` (deterministic hash, override-able) |
| delco_orchestrator (Temporal) | Implicit — `/api/offer` calls pay+bonus internally |
| courier_offer_service | `/api/offer/:tenant` (composition + layout assembly) |
| courier_mobile_async + AppSync | Client page fetches `/api/offer/:tenant` (poll) |
| Layout/Experiment config | `/api/config/:tenant` (admin page CRUD) |

---

## Project Structure

```
~/Documents/Git2/couriers/task/demo/
├── package.json
├── vite.config.js
├── server/
│   ├── index.js                  # Express server
│   ├── data/
│   │   ├── configs.json          # Saved layout configs + variants per tenant
│   │   └── sample-offers.json    # Sample offer data per tenant (tenant-consistent fixtures)
│   └── routes/
│       ├── config.js             # CRUD for layout configs
│       ├── courier-pay.js        # Mock Courier Pay Service
│       ├── courier-bonus.js      # Mock Courier Bonus Service (also serves acceptance rate)
│       ├── experiment.js         # Mock Experiment Resolver (deterministic hash + override)
│       └── offer.js              # Offer assembly (resolves variant, calls pay+bonus, applies layout)
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # Router: /admin and /client
│   ├── pages/
│   │   ├── AdminPage.jsx         # Layout configurator (control + treatment side-by-side)
│   │   └── ClientPage.jsx        # Offer renderer (mobile simulator) with variant toggle
│   ├── components/
│   │   ├── admin/
│   │   │   ├── ComponentList.jsx       # Draggable list of components
│   │   │   ├── TenantSelector.jsx      # Dropdown: CH, UK, CA
│   │   │   ├── VariantTabs.jsx         # Switch between control vs treatment editing
│   │   │   ├── HintsEditor.jsx         # Configure hints (highlight, theme)
│   │   │   └── EarningsModelSelector.jsx # flat/distance/surge/tips
│   │   └── offer/
│   │       ├── OfferRenderer.jsx       # Component registry (maps layout → components)
│   │       ├── EarningsTotal.jsx       # "$9.76 Includes tip"
│   │       ├── EarningsBreakdown.jsx   # Line-by-line breakdown
│   │       ├── DistanceSummary.jsx     # "7.7 km · 2 stops"
│   │       ├── StopDetails.jsx         # Pickup/delivery with ETAs
│   │       ├── AcceptCta.jsx           # Accept button with countdown
│   │       ├── CustomerNote.jsx        # "Note from DataTest: Hello!"
│   │       ├── AcceptanceRate.jsx      # Progress bar
│   │       ├── SurgeIndicator.jsx      # "1.3x surge - Downtown Calgary"
│   │       ├── TipPrediction.jsx       # "Estimated tip: $2-$4"
│   │       └── RouteMap.jsx            # Simple map placeholder
│   └── styles/
│       ├── admin.css
│       └── offer.css                   # Dark theme matching real app
└── README.md
```

---

## Server Implementation

### `/api/courier-pay/:deliveryId` (Mock Courier Pay)

```json
// Response
{
  "deliveryId": "2f9a2aa6-429e-4b54-bbdd-384673b00f63",
  "totalRateValue": 726,
  "tip": 250,
  "distanceExpenseAllowance": 50
}
```

### `/api/courier-bonus/:courierId` (Mock Courier Bonus)

```json
// Response
{
  "courierId": "0193c1da-6bd8-1a28-f428-b2fb6bbf9d76",
  "bonuses": [
    { "type": "peak_hour", "value": 100 },
    { "type": "consecutive_delivery", "value": 50 }
  ],
  "topUpPromotion": {
    "currentAcceptanceRate": 50,
    "requiredAcceptanceRate": 80,
    "showAcceptanceRate": true
  }
}
```

### `/api/experiment/:courierId` (Mock Experiment Resolver)

```
GET /api/experiment/c123?experimentId=earnings_display
GET /api/experiment/c123?experimentId=earnings_display&forceVariant=treatment   // preview override
```

Implementation: deterministic — `hash(courierId + experimentId) % 100` decides assignment based on the experiment's `treatment_pct`. Same courier always gets the same variant (sticky). The `forceVariant` query param overrides for the preview toggle.

```json
{
  "courierId": "c123",
  "experimentId": "earnings_display",
  "variant": "treatment",
  "group": "treatment",
  "rolloutPct": 50,
  "source": "hash"            // or "override" when forceVariant is used
}
```

### `/api/offer/:tenant` (Offer Assembly — the key route)

```
GET /api/offer/CA?courierId=c123&forceVariant=treatment
```

Logic:
1. Read tenant config from `configs.json` (control + treatment variants).
2. For each experiment in the config, call `/api/experiment` → resolved variant.
3. Pick the variant's layout/hints/earnings_model (or fall back to control).
4. Call `/api/courier-pay` and `/api/courier-bonus` internally.
5. Read sample offer fixture for the tenant.
6. Apply earnings model (flat/distance/surge/tips) to format data.
7. Build modular payload: `{ version, tenant, experiment, layout, data, hints }`.
8. Return assembled offer.

```json
// Response example (CA tenant, treatment variant — surge model)
{
  "version": 2,
  "tenant": "CA",
  "courier_id": "c123",
  "experiment": {
    "assignments": {
      "earnings_display": { "variant": "treatment", "group": "treatment", "source": "hash" }
    }
  },
  "layout": {
    "components": ["route_map", "earnings_breakdown", "surge_indicator", "distance_summary", "stop_details", "accept_cta"],
    "hints": { "highlight": "surge", "theme": "urgent" }
  },
  "data": {
    "route_map": {
      "pickup":   { "lat": 51.0962, "lng": -114.1389, "name": "Calgary The First" },
      "delivery": { "lat": 51.0395, "lng": -114.1010, "name": "DataTest" }
    },
    "earnings_breakdown": {
      "model": "surge",
      "base_pay": 726,
      "surge_amount": 150,
      "tip": 250,
      "bonuses": [{ "type": "peak_hour", "value": 100 }],
      "total": 1226,
      "currency": "CAD",
      "display_total": "$12.26"
    },
    "surge_indicator": { "multiplier": 1.3, "zone": "Downtown Calgary" },
    "distance_summary": { "value": 7.7, "unit": "km", "stops": 2, "display": "7.7 km · 2 stops" },
    "stop_details": {
      "stops": [
        { "type": "COLLECT", "name": "Calgary The First", "address": "11200 37 Street SW, Edmonton", "arrive_at": "2:12 PM" },
        { "type": "DELIVER", "name": "DataTest",          "address": "2631 17 Ave SW, Calgary",      "arrive_at": "2:16 PM" }
      ]
    },
    "accept_cta": { "countdown_seconds": 40, "expiration_timestamp": 1777667661814 }
  }
}
```

**Note on coordinates and addresses:** Each tenant fixture must be self-consistent. The CA fixture above uses Calgary lat/lng — do not copy from `sample-offer-payload.json`, which is a CH (Bern, Switzerland) capture and would give the wrong map pins.

---

## Admin Page Features

1. **Tenant selector** — dropdown: CH, UK, CA
2. **Variant tabs** — `control` / `treatment` (each tab edits its own layout + hints + earnings model)
3. **Component list** — drag-and-drop reordering
   - Available components: see "Canonical Component Names" above
   - Each has toggle (show/hide in layout)
4. **Hints editor** — key-value pairs (highlight, theme, animation)
5. **Earnings model selector** — flat_rate / distance_based / surge / tips_prediction
6. **Distance unit** — km / miles
7. **Rollout percent** — slider 0–100 (treatment_pct for the experiment)
8. **Save button** → POST /api/config/:tenant
9. **Payload preview** — shows resulting JSON for both variants side-by-side

---

## Client Page Features

1. **Tenant selector** — matches admin
2. **Courier ID input** — defaults to a fixed demo ID; changing it can flip the resolved variant (sticky hash)
3. **Variant toggle** — `auto` (use hash) / `control` / `treatment` — passes `forceVariant` to the offer endpoint
4. **Fetch offer button** — calls `GET /api/offer/:tenant?courierId=&forceVariant=`
5. **Phone frame** — dark background, mobile aspect ratio (~390×844)
6. **Component registry** — iterates `layout.components[]`, renders matching component for each; unknown component types are skipped silently with a small dev-only annotation
7. **Mock actions:**
   - "Accept offer" → `alert("Offer accepted!")`
   - "Decline" → `alert("Offer declined")`
   - "Navigate to business" → `alert("Opening navigation...")`
   - Countdown timer → live ticking (decrements every second)
8. **Payload inspector** — collapsible panel showing the raw JSON received, with `experiment.assignments` highlighted at the top

---

## Default Configs Per Tenant

Each tenant defines an `experiment_id` and two variants (`control`, `treatment`). The Experiment Resolver picks one per courier; admins can preview either via the variant toggle.

```json
{
  "CH": {
    "experiment_id": "earnings_display_ch",
    "treatment_pct": 0,
    "variants": {
      "control": {
        "layout": ["route_map", "earnings_total", "distance_summary", "stop_details", "accept_cta"],
        "hints": {},
        "earnings_model": "flat_rate",
        "distance_unit": "km"
      },
      "treatment": {
        "layout": ["route_map", "earnings_breakdown", "distance_summary", "stop_details", "accept_cta"],
        "hints": { "highlight": "earnings" },
        "earnings_model": "flat_rate",
        "distance_unit": "km"
      }
    }
  },
  "UK": {
    "experiment_id": "tip_prediction_uk",
    "treatment_pct": 50,
    "variants": {
      "control": {
        "layout": ["route_map", "earnings_breakdown", "distance_summary", "stop_details", "accept_cta"],
        "hints": {},
        "earnings_model": "distance_based",
        "distance_unit": "miles"
      },
      "treatment": {
        "layout": ["route_map", "earnings_breakdown", "tip_prediction", "distance_summary", "stop_details", "accept_cta"],
        "hints": { "highlight": "tip" },
        "earnings_model": "distance_based",
        "distance_unit": "miles"
      }
    }
  },
  "CA": {
    "experiment_id": "surge_indicator_ca",
    "treatment_pct": 25,
    "variants": {
      "control": {
        "layout": ["route_map", "earnings_total", "distance_summary", "stop_details", "customer_note", "acceptance_rate", "accept_cta"],
        "hints": {},
        "earnings_model": "flat_rate",
        "distance_unit": "km"
      },
      "treatment": {
        "layout": ["route_map", "earnings_breakdown", "surge_indicator", "distance_summary", "stop_details", "customer_note", "acceptance_rate", "accept_cta"],
        "hints": { "highlight": "surge", "theme": "urgent" },
        "earnings_model": "surge",
        "distance_unit": "km"
      }
    }
  }
}
```

## Tenant-Consistent Fixtures (`sample-offers.json`)

Each tenant has its own offer fixture so map pins and addresses match the tenant. Do **not** reuse `../sample-offer-payload.json` — that's a CH (Bern) capture only.

```json
{
  "CH": {
    "offerId": "ch-demo-1",
    "currency": "CHF",
    "stops": [
      { "type": "COLLECT", "name": "Swi001 (Swi001)", "address": "Bonstettenstrasse 2, 3012 Bern", "lat": 46.9579, "lng": 7.4369, "arrive_at": "2:12 PM" },
      { "type": "DELIVER", "name": "DataTest",         "address": "Schauplatzgasse 10, 3011 Bern", "lat": 46.9475, "lng": 7.4426, "arrive_at": "2:16 PM" }
    ],
    "distance_km": 6.4,
    "customer_note": "Hello!"
  },
  "UK": {
    "offerId": "uk-demo-1",
    "currency": "GBP",
    "stops": [
      { "type": "COLLECT", "name": "London Pizza",    "address": "12 Camden High St, London",    "lat": 51.5390, "lng": -0.1426, "arrive_at": "6:42 PM" },
      { "type": "DELIVER", "name": "DataTest UK",     "address": "55 Eversholt St, London",      "lat": 51.5302, "lng": -0.1314, "arrive_at": "6:55 PM" }
    ],
    "distance_miles": 4.8,
    "customer_note": "Leave at door, please."
  },
  "CA": {
    "offerId": "ca-demo-1",
    "currency": "CAD",
    "stops": [
      { "type": "COLLECT", "name": "Calgary The First", "address": "11200 37 Street SW, Edmonton", "lat": 51.0962, "lng": -114.1389, "arrive_at": "2:12 PM" },
      { "type": "DELIVER", "name": "DataTest",          "address": "2631 17 Ave SW, Calgary",      "lat": 51.0395, "lng": -114.1010, "arrive_at": "2:16 PM" }
    ],
    "distance_km": 7.7,
    "customer_note": "Hello!"
  }
}
```

---

## Demo Flow (Verification)

1. `npm run dev` → starts Vite + Express
2. Open Admin (`/admin`):
   - Select "CA"
   - On the **treatment** tab, drag "surge_indicator" in and swap "earnings_total" → "earnings_breakdown"
   - Set earnings model: "surge", hint: highlight=surge
   - Set rollout to 25%
   - Save
3. Open Client (`/client`):
   - Select "CA", courierId = `c123`, variant = `auto`
   - Click "Fetch Offer" — payload inspector shows `experiment.assignments.surge_indicator_ca.variant: "control"` (deterministic for c123 at 25%)
   - Switch variant toggle to `treatment` → re-fetch → surge breakdown + surge indicator appears, hints show urgent theme
   - Countdown ticks; click "Accept" → alert
4. Change courierId to `c999` with variant = `auto` → may resolve to `treatment` (sticky-hashed differently)
5. Switch tenant to "UK" → fixture changes to London addresses, miles, tip_prediction available on treatment
6. **Two key proofs:**
   - Admin changed config → client shows different UI → no "app release"
   - Same courier ID always resolves to the same variant; different couriers split per `treatment_pct`

---

## Implementation Order

1. Init Vite + Express project, configure proxy
2. Author `sample-offers.json` fixtures per tenant (CH/UK/CA), keep coords + addresses self-consistent
3. Build server: mock pay/bonus/experiment routes + offer assembly + config CRUD
4. Build offer components (dark theme matching screenshots), include unknown-component skip behavior
5. Build Client Page with component registry, phone frame, courierId input, variant toggle, payload inspector
6. Build Admin Page with tenant selector, control/treatment tabs, drag-drop, hints editor, rollout slider
7. Test full flow end-to-end (both proofs from "Demo Flow" above)
