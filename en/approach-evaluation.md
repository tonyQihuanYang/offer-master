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

### What is the actual difference between Approach B and Hybrid (C)?

This is the **most likely follow-up**, because the prompt only offers A and B —
so an interviewer will probe whether you actually understand how C differs from
B (they look nearly identical: both send raw data, both render natively).

**The one structural difference: who decides the *layout* — which components
appear, in what order, shown/hidden.**

| | Approach B (raw + mobile) | Hybrid (C) |
|---|---|---|
| Sends raw data | Yes | Yes |
| Native rendering | Yes | Yes |
| **Decides which components + order + visibility** | **Mobile** (interprets feature flags and composes the screen itself) | **Server** (sends a `layout[]` descriptor in the payload) |
| Where A/B logic lives | Split: backend flags + mobile interpretation | Server (Experiment Resolver + Layout Composer); mobile just renders |

> **One-liner:** In B, "which components and in what order" is *application
> logic on mobile*. In C, it is *data from the server*.

#### Concrete payload contrast

**B — mobile composes the layout from flags:**
```json
{
  "data": { "base_pay": 450, "tip": 80, "surge": 120, "distance_km": 3.2 },
  "experiment_id": "earnings_v2",
  "flags": { "show_surge": true, "earnings_style": "breakdown" }
}
```
Mobile contains the composition logic: *"if `earnings_style == breakdown`, place
EarningsBreakdown first, then check `show_surge` to decide on SurgeIndicator…"* —
that branching lives in the app.

**C — server sends the composed layout:**
```json
{
  "experiment": { "earnings_display": { "variant": "breakdown_v2", "group": "treatment" } },
  "layout": { "components": ["earnings_breakdown", "surge_indicator", "distance_summary", "accept_cta"] },
  "data": { "earnings_breakdown": { /* ... */ }, "surge_indicator": { /* ... */ } }
}
```
Mobile is one loop: `for component in layout.components → registry[component].render(data)`.
No "what to show" branching in the app at all.

#### Consequences

| Scenario | B | C |
|---|---|---|
| New layout experiment (reorder, show/hide, swap an existing component) | Only variants **pre-shipped behind a flag** are testable; a genuinely new arrangement = **app release** | Server config change, **no app release** (as long as the components already exist) |
| New component *type* | App release | App release (**same** — this is why B and C get conflated) |
| Mobile complexity | Higher — composition + flag interpretation + rendering | Bounded — rendering only |
| iOS/Android consistency | Each platform writes its own composition logic → drift risk | Order comes from one server-side `layout[]` → consistent by construction |

> **Precise framing (a Staff signal):** don't say "B always needs an app
> release." Say: *B can only test variants it already shipped behind flags; any
> new arrangement needs a release. C can rearrange any existing components purely
> from server config.*

#### The cleanest summary

> *"C is essentially B + a server-controlled layout descriptor, with experiment
> assignment moved from mobile up to the server. B gives mobile both the
> **presentation** and the **composition** layer; C splits them — server owns
> **composition** (what + order), mobile owns **presentation** (how). That split
> is exactly what buys experimentation without app releases while keeping native
> UX."*

The runnable `demo/` is Approach C: the server sends `layout.components[]` and
the client's `OfferRenderer` just iterates and renders. To be Approach B, the
server would send raw data + flags and the "which components to show" logic would
move into the client.

---

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

#### Why do A and C look so similar? (the string-vs-value spectrum)

A common reaction when you render A and C side by side (see the demo's `/approaches` page): *they look almost identical.* True for a static card — and worth understanding why.

**Approach A is a spectrum:**
- *Purest A:* server sends finished HTML / an image → mobile knows nothing (a WebView).
- *Widget-DSL A:* server sends `{ widget: "amount", text: "$11.76" }` → mobile has a generic interpreter mapping widget types to native widgets. **This form is close to C** — hence the visual similarity.

**The crux: A puts the *formatted string* on the wire (`"$11.76"`); C puts the *raw value* (`976`).** With only a string, the mobile side can style the container (font, color, CSS transition) but **cannot do anything that needs the value**:

| Capability | A (has the string `"$11.76"`) | C (has the value `976`) |
|---|---|---|
| Style the box (font/color/fade-in) | ✅ | ✅ |
| Count-up / value-driven animation | ❌ no number to animate | ✅ |
| Re-format by locale (`CA$9.76`, RTL digits, separators) | ❌ already formatted server-side | ✅ native `Intl`/`NumberFormatter` |
| Conditional on value (red if low) | ❌ doesn't know the value | ✅ |
| Long-press → base $6.50 + tip $3.26 | ❌ breakdown isn't on the wire | ✅ has the fields |

So A and C are the same on a **static frame** and diverge the moment you need **behavior or the underlying data**. The more data + hints you add to A, the more it converges toward C.

#### Why is A "heavier" on the server at 2M/h?

"Heavy" is relative — rendering a small card isn't huge CPU. The real points are *where* the work happens:

- **On the latency path.** Per offer, A runs the template engine + formats every field + does i18n (15 countries: currency/date/RTL) **before sending** → it eats into the ~20ms p95 headroom. C just passes raw values through (≈0 on-path); formatting happens later, on the device.
- **Centralized vs edge.** A's formatting cost lives on your server fleet — you scale it for the ~1500/sec peak. C pushes it to **50,000 phones**, each formatting its own single offer: free, perfectly parallel, with native OS locale support.
- **i18n is the multiplier.** Server-side per-offer localization for 15 markets is real CPU plus code to maintain; on mobile it's native and free.

> Honest caveat: this is a **secondary** argument — native UX is the bigger reason to choose C. At ~556/sec a compiled-template renderer might well be fine. The point is you'd be paying **centrally, on the latency path**, for what C gets **free on the edge**.

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
