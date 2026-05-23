# Approach Evaluation: A vs B vs Hybrid

## Approach A: Server-Side Template Engine (DSL)

```
courier_offer_service:
  data + DSL template ──▶ Template Engine ──▶ rendered payload ──▶ Mobile (dumb renderer)
```

| Pros | Cons |
|------|------|
| Mobile stays simple — just renders what it gets | Every presentation change = backend deployment |
| No app store release for experiments | DSL becomes its own language to maintain/debug/test |
| Guaranteed consistency across iOS/Android | Adds latency (template parsing within 200ms SLA) |
| Easy to audit what courier saw | Backend team becomes bottleneck for all UI changes |
| Single point of control | Can't leverage native mobile capabilities |
| | Heavier compute at 2M offers/hour peak |

**Industry examples:**
- **Shopify** — Server-Driven UI (Shop App): Closer to pure Approach A — server determines templates, sections, and layout. Client component hierarchy is simpler (just routes to section type). → [See detailed reference below](#industry-reference-shopify-server-driven-ui-approach-a-example)
- **Airbnb** — "Ghost Platform": Frequently cited under Approach A in industry write-ups, but the architecture is actually hybrid (sections are pre-formatted server data; mobile renders natively). Categorized under Approach C below.

---

## Approach B: Configuration-Driven (Raw Data + Mobile Rendering)

```
courier_offer_service:
  raw data + experiment ID + feature flags ──▶ Mobile (owns all UI logic)
```

| Pros | Cons |
|------|------|
| Natural evolution of current architecture | Duplicated rendering logic (iOS + Android) |
| Mobile leverages native UI | App store release cycle blocks experiments |
| Backend decoupled from presentation | Old app versions may not understand new fields |
| Lighter backend — easy 200ms SLA | Harder to guarantee iOS/Android consistency |
| Clear separation of concerns | Mobile team complexity increases significantly |
| | Harder to audit what courier actually saw |

**Industry examples:**
- **DoorDash** — Backend sends data, mobile owns presentation. Heavy use of feature flags (Statsig) for A/B testing.
- **Deliveroo** — Data-driven offers; backend sends offer data, mobile handles presentation with feature flags for experiments.

---

## Approach C (Recommended): Hybrid — Server-Controlled Layout + Mobile Rendering

```
courier_offer_service:
  raw data + experiment + layout descriptor + presentation hints ──▶ Mobile (component registry)
```

Example payload:
```json
{
  "experiment": { "variant": "earnings_breakdown_v2", "group": "treatment" },
  "layout": ["header", "earnings_breakdown", "distance_info", "urgency_badge", "accept_cta"],
  "data": {
    "earnings_breakdown": { "base": 450, "surge": 120, "tip_estimate": 80, "total": 650 },
    "distance_info": { "km": 3.2, "estimated_minutes": 12 },
    "urgency_badge": { "level": "high", "nearby_couriers": 5 }
  },
  "hints": { "highlight": "surge", "theme": "urgent" }
}
```

| Pros | Cons |
|------|------|
| No app release for most experiments | Requires upfront contract design (backend + mobile) |
| Native rendering (mobile owns how components look) | New component types still need app release (but rare) |
| Server controls what/order, mobile controls how | More complex initial implementation |
| Bounded mobile complexity (finite set, ~10-15 components) | Needs governance on component definitions (review board, versioning rules) |
| Light backend — easy 200ms SLA | Version negotiation for old apps |
| No DSL to maintain | Breaking changes to a component's data schema still require app release or dual-emit migration (only *new* components get free forward-compat) |
| Forward compatible (unknown components skipped) | |
| Natural evolution from current Offer.java | |

**Industry examples:**
- **Airbnb** (Ghost Platform) — Server sends structured sections (data + layout placements + actions), mobile renders natively via SectionComponents. Server controls what/where, mobile controls how. Experimentation via section inclusion, SectionComponentType variants, and layout placement changes. → [See detailed reference below](#industry-reference-airbnb-ghost-platform-hybrid-example)
- **Uber** — "RIB Architecture" + server config. Backend sends structured data + display configuration, mobile has component tree.
- **Lyft** — Server-driven screens for driver earnings and ride offers. Backend defines layout, mobile renders natively.
- **Grab** — Backend sends offer data + layout hints for driver/rider apps.

### Schema evolution within a component

"Forward compatible" only covers *new component types* — old apps skip what they don't know. Changing the **data shape of an existing component** is harder:

| Change | Strategy |
|--------|----------|
| Add an optional field | Safe — old apps ignore it |
| Remove a field | Server must keep emitting it until min-supported app version drops it |
| Rename a field | Dual-emit (old name + new name) for one release cycle, then drop |
| Repurpose / change semantics of a field | Treat as a new component (e.g., `earnings_breakdown_v2`) |

This is the main reason a component registry needs governance — versioned data contracts per component, not just a flat name list.

---

## Three-Way Comparison

| Criteria | A (Template DSL) | B (Raw Data) | C (Hybrid) |
|----------|-------------------|--------------|-------------|
| **Experiment speed** | Fast (no app release) | Slow (app release) | Fast for layout changes, slow only for new components |
| **200ms SLA risk** | High (rendering cost) | Low | Low |
| **2M/hour compute** | Heavy | Light | Light |
| **Mobile complexity** | Low | High | Medium (bounded) |
| **Backend bottleneck** | High | Low | Medium (layout config only) |
| **iOS/Android consistency** | Guaranteed | Hard to enforce | Enforced by shared component spec |
| **Native UX quality** | Poor | Excellent | Excellent |
| **Backward compat** | Easy | Hard | Medium (unknown components skipped) |
| **Auditability** | Easy | Hard | Easy (layout + data logged) |
| **Fits current arch** | New paradigm | Natural extension | Natural extension + light structure |
| **Time to build** | High (DSL engine) | Medium | Medium |

---

## Summary

| | Best for | Worst for |
|---|----------|-----------|
| **A** | Teams with weak mobile capacity, strict consistency needs | Speed, native UX, scale |
| **B** | Strong mobile teams, maximum native flexibility | Experimentation velocity, consistency |
| **C** | Balanced teams, need experiments without app releases + native UX | Teams wanting zero coordination between backend/mobile |

---

## Industry Reference: Airbnb Ghost Platform (Hybrid Example)

Source: [A Deep Dive into Airbnb's Server-Driven UI System](https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5)

### Classification: Hybrid (not pure Approach A)

Despite being called "server-driven UI," Ghost Platform is actually a **hybrid** approach:

| Aspect | Pure Approach A | Airbnb GP (Hybrid) |
|--------|----------------|-------------------|
| Server sends | Fully rendered template | Structured sections with data + layout placements |
| Mobile renders | Dumb passthrough | **Native Section Components** (Swift/Kotlin) |
| Mobile has logic | No | Yes — maps SectionComponentType → native renderer |
| DSL/template engine | Yes | No — structured data in GraphQL schema |
| Data formatting | Client-side | **Server-side** (pre-translated, localized, formatted) |

The server controls *what* to show and *where* to place it. Mobile controls *how* it looks using native rendering. This is the hybrid pattern.

### Core Concepts

| Concept | Purpose |
|---------|---------|
| **Section** | Primitive building block — "contains the exact data to be displayed, already translated, localized, and formatted" |
| **Screen** | Organizes section layout; references sections by ID |
| **ILayout** | Responsive layout interface (compact vs wide breakpoints) |
| **IAction** | Server-defined interaction handlers (tap, swipe) without client logic |
| **SectionComponentType** | Controls how a section is rendered (same data, different visual) |

### Response Structure (GPResponse)

```json
{
  "sections": [
    {
      "id": "toolbar_section",
      "sectionComponentType": "TOOLBAR",
      "data": {
        "title": "Listing Details",
        "subtitle": "Downtown Loft",
        "onSubtitleClickAction": { "type": "NAVIGATE", "url": "/listing/123" }
      }
    },
    {
      "id": "book_bar_footer",
      "sectionComponentType": "BOOK_BAR",
      "data": {
        "price": "$120/night",
        "button": {
          "label": "Reserve",
          "onClickAction": { "type": "NAVIGATE", "url": "/booking/start" }
        }
      }
    },
    {
      "id": "photos_section",
      "sectionComponentType": "PHOTO_GALLERY",
      "data": { "photos": ["url1", "url2", "url3"] }
    }
  ],
  "screens": [
    {
      "id": "ROOT",
      "screenProperties": { "presentation": "FULL_SCREEN" },
      "layoutsPerFormFactor": {
        "compact": {
          "type": "SingleColumnLayout",
          "placements": [
            { "id": "nav", "sectionDetails": [{ "sectionId": "toolbar_section" }] },
            { "id": "main", "sectionDetails": [{ "sectionId": "photos_section" }] },
            { "id": "footer", "sectionDetails": [{ "sectionId": "book_bar_footer" }] }
          ]
        }
      }
    }
  ]
}
```

### Key Design Decisions

1. **Sections are independent** — no section knows about other sections or which screen it's on
2. **Sections referenced by ID** — screens point to sections, enabling reuse and smaller payloads
3. **One data model, multiple renderers** — `SectionComponentType` allows same data to render differently (e.g., `TITLE` vs `PLUS_TITLE`)
4. **Actions are server-defined** — mobile just calls `GPActionHandler.handleIAction(action)`, no client-side routing logic
5. **Unified schema** — same GraphQL schema across all platforms (web, iOS, Android)

### Mobile Rendering (Kotlin example)

```kotlin
// Section components map data → native UI
class TitleSectionComponent : SectionComponent {
    fun render(data: TitleSectionData) -> View {
        // Native platform rendering
    }
}

// Action handling
button(
    onClickListener = {
        GPActionHandler.handleIAction(section.button.onClickAction)
    }
)
```

### Rendering Flow

```
Server GPResponse
    → Parse sections[] and screens[]
    → Select ILayout based on device form factor
    → For each placement in layout:
        → Find referenced section by ID
        → Look up SectionComponent for that section's type
        → Build native UI using section data
        → Place built UI into layout position
        → Attach IAction handlers
```

### Strengths for Offer System Comparison

| Airbnb GP Strength | Relevance to Courier Offers |
|---|---|
| Sections are pre-formatted (translated, localized) | Earnings could be pre-formatted server-side |
| Layout varies by form factor | Layout could vary by experiment/zone |
| Actions are server-defined | Accept/decline behavior could be server-configured |
| Same schema, all platforms | Consistent offer experience iOS/Android |

### Limitations for Courier Offers

| Limitation | Why it matters |
|---|---|
| No documented A/B testing mechanism | Need to add experiment assignment layer on top |
| Heavy GraphQL dependency | Current system uses SQS/JSON, not GraphQL |
| Server formats everything | Adds computation at 2M offers/hour scale |
| Tightly coupled to Airbnb's infrastructure | Not directly reusable, only pattern-level inspiration |

### How They Likely Handle Experimentation

The article doesn't explicitly document A/B testing, but the architecture enables it at **3 levels**:

```
Experiment Assignment (upstream, before GP response is built)
    │
    ├── Level 1: SECTION INCLUSION
    │   → Different users get different sections in sections[]
    │   → Example: 50% get "price_breakdown_section", 50% get "simple_price_section"
    │
    ├── Level 2: SECTION COMPONENT TYPE
    │   → Same data model, different renderer
    │   → Example: same price data rendered as "PRICE_CARD" vs "PRICE_MINIMAL"
    │   → Server sets sectionComponentType per user
    │
    └── Level 3: LAYOUT PLACEMENTS
        → Different placement order in screens[].placements
        → Show/hide sections by including/excluding from placements
        → Reorder sections without changing data
```

The GP framework itself is **experiment-agnostic** — it just renders whatever the server sends. The experimentation happens **upstream** when building the GPResponse: an experiment service decides which sections, component types, and layouts to include for each user.

This is the same pattern our hybrid approach uses: Experiment Resolver decides → Layout Composer builds → Payload Builder outputs.

---

## Industry Reference: Shopify Server-Driven UI (Approach A Example)

Source: [Server-Driven UI in Shop App](https://shopify.engineering/server-driven-ui-in-shop-app)

### How It Works

Shopify's Shop App uses server-driven UI for the Store Screen, where the backend decides which product sections to show.

### Architecture Layers

```
┌─────────────────────────────────────┐
│  Template Processing                │  ← Reads hard-coded + merchant-specific templates
├─────────────────────────────────────┤
│  Data Loading (SectionDataLoaders)  │  ← Creates loaders for each section to render
├─────────────────────────────────────┤
│  GraphQL Layer                      │  ← Maps data objects to GraphQL types
├─────────────────────────────────────┤
│  Orchestration Layer                │  ← Coordinates the flow
└─────────────────────────────────────┘
```

### Client Component Hierarchy

```
ServerDrivenStoreScreen
  └── StoreSectionContainer (routes to section type)
        ├── ProductsSection
        │     ├── ProductGrid (layout: grid)
        │     └── ProductShelf (layout: shelf)
        └── CollectionsSection
              └── CollectionShelf
```

### Key Features

- **Template-based:** Server reads templates (default + merchant customizations) to determine sections
- **Layout as data:** Each section has a layout type (Grid/Shelf) and size (large/medium/small)
- **Experimentation:** "Control which experiments are currently being run, and which templates are shown for a merchant" — no app release needed
- **Two GraphQL calls:** `StoreSections` (sections to render) + `ShopInfo` (cached merchant info)

---

## Q&A

### What is the actual difference between Approach A and Hybrid?

The one real difference: **where does presentation logic live?**

Presentation logic = formatting numbers, choosing display text, conditional visibility, highlighting, layout decisions.

| | Approach A | Hybrid |
|---|---|---|
| **Server decides** | What to show + **how it looks** | What to show + **in what order** |
| **Mobile decides** | Nothing (just paint pixels) | **How it looks** (formatting, animation, styling) |

#### Concrete Example: Showing "$9.76 includes tip"

**Approach A — presentation logic is SERVER-SIDE:**

Server has a template/DSL:
```
IF tip > 0:
  display = "{{total | format_currency}} includes tip"
ELSE:
  display = "{{total | format_currency}}"
```

Server sends the **final result**:
```json
{ "earnings_text": "$9.76", "earnings_subtitle": "Includes tip" }
```

Mobile just renders whatever string it gets. Mobile doesn't know what "976 cents" is.

---

**Hybrid — presentation logic is MOBILE-SIDE:**

Server sends **raw data + component name**:
```json
{
  "layout": ["earnings_total"],
  "data": {
    "earnings_total": { "amount": 976, "currency": "CAD", "includes_tip": true }
  }
}
```

Mobile's `EarningsTotalComponent` has the logic:
```kotlin
fun render(data: EarningsTotal) {
    totalLabel.text = formatCurrency(data.amount, data.currency)  // "$9.76"
    subtitleLabel.text = if (data.includesTip) "Includes tip" else ""
    // Can also: animate, change color, adapt to dark mode, etc.
}
```

#### When does this matter?

| Scenario | Approach A | Hybrid |
|---|---|---|
| Change "$9.76" to "CA$9.76" | Change server template, deploy backend | Mobile formats based on currency code (already handles it) |
| Add animation when tip > $5 | **Impossible** — server can't send animations | Mobile adds it in component logic |
| Show tip amount on long-press | New template + new field + backend deploy | Mobile already has the data, just add interaction |
| A/B test "Includes tip" vs "Tip: $2.50" | Two templates on server, swap per experiment | Two components or one with variant logic |
| Support Arabic (RTL) | Template must generate RTL strings | Mobile handles RTL natively |

#### When they're the SAME

Both approaches are identical in:
- Server decides WHICH components/sections appear
- Server decides the ORDER of components
- Server can show/hide sections per experiment
- Mobile renders natively (not WebView)

#### Summary

```
Approach A:  Server does formatting → sends strings  → Mobile paints them
Hybrid:      Server sends raw data  → Mobile formats → Mobile paints them
```

If you want mobile to be **truly dumb** (zero logic, just paint) → Approach A.
If you want mobile to **own the UX** (formatting, interactions, accessibility, animations) → Hybrid.

For a courier app where UX quality matters (fast accept, clear earnings, native feel) — Hybrid wins because mobile makes the offer feel native rather than "server-rendered text in boxes."

---

### Why do Airbnb and Shopify use GraphQL for server-driven UI?

GraphQL is a natural fit for server-driven UI because of:

1. **Union types / polymorphism** — Sections can be different types (`ProductSection | PriceSection | MapSection`). GraphQL models this natively; REST needs manual `"type"` discriminators.
2. **Client asks for exactly what it needs** — Different app versions request different fields from the same schema. No versioned endpoints needed.
3. **Strongly typed schema = contract** — Schema IS the documentation. Code generation gives type-safe models (Kotlin/Swift) for free.
4. **Single endpoint, multiple resources** — One call fetches sections + layout + actions. Reduces round-trips.

### Do we need GraphQL for the hybrid approach?

**No.** Our system uses AWS AppSync which is GraphQL under the hood (WebSocket subscriptions), but the offer payload is sent as an opaque JSON string in the `data` field:

```
courier_offer_service → SQS → courier_mobile_async_service → AppSync (GraphQL mutation) → WebSocket → Mobile
```

```graphql
subscription onOfferReceived($courierId: ID!) {
  courierMobileEvent(courierId: $courierId) {
    subject
    data    # ← opaque JSON string (the Offer payload)
  }
}
```

We're using "GraphQL as transport" not "GraphQL as data contract." The hybrid approach works with plain JSON because:

| | GraphQL (Airbnb/Shopify) | JSON push via AppSync (our system) |
|---|---|---|
| Direction | Client pulls | Server pushes |
| Latency | Client waits for response | Instant delivery via WebSocket |
| Flexibility | Client picks fields | Server decides full payload |
| For offers | Overkill (courier doesn't choose what to see) | Perfect fit (server controls everything) |

**Recommendation:** Keep `data` as JSON string. The modular payload is typed in Java (records) and mobile (data classes). Type safety is enforced at build time, not transport time. Migrating to a typed AppSync schema is optional and can be done later without changing the architecture.

---

## Sources

- [Airbnb Ghost Platform - Server-Driven UI](https://medium.com/airbnb-engineering/a-deep-dive-into-airbnbs-server-driven-ui-system-842244c5f5)
- [Shopify Server-Driven UI](https://shopify.engineering/server-driven-ui-in-shop-app)
