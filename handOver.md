# Handover: Items Needing Repo Verification

This file lists claims and assumptions in the offer-master docs that I could not verify without access to the live repos (`courier_offer_service`, `delco_orchestrator`, `courier_mobile_async_service`, iOS/Android apps). Another agent with repo access should confirm or correct each item, then strike it from this list and update the corresponding doc.

Doc references use the file paths in this folder:
- `courier-offer-system-architecture.md` (current state)
- `hybrid-end-to-end-design.md` (proposed design)
- `approach-evaluation.md` (decision doc)
- `demo/PLAN.md` (demo build plan)
- `sample-offer-payload.json` (real CH `JobSummaryUpdated` capture)

---

## 1. Payload identity: `JobSummaryUpdated` vs `SendCourierMobileEvent.data`

**Claim under review.** `courier-offer-system-architecture.md` describes `sample-offer-payload.json` as the `JobSummaryUpdated` event consumed by `courier_offer_service`, and notes that `amount` and `fees.jobPay` are zero because earnings are filled in later via the Temporal workflow before the final `SendCourierMobileEvent` is published.

**Open questions:**
- Is the top-level shape of `SendCourierMobileEvent.data` literally the same Java record (`Offer.java`) as the inbound `JobSummaryUpdated`, with pay/bonus fields populated, or is it a different envelope?
- Where exactly does pay get merged in? Confirm it lands in `fees.jobPay` (and `amount`?) of each `JobDetails`, or in a separate top-level field.

**How to verify.**
- Read `infrastructure/events/dto/out/Offer.java` and the publish path: `domain/offer/AbstractOfferService.sendOfferWithPayBonus()` → `EventPublishingService.serializeOffer()`.
- Compare to the inbound DTO consumed by `infrastructure/events/handlers/JobSummaryUpdatedHandler.java`.

**What to update.** The "Note on sources" callout in `courier-offer-system-architecture.md` (Sample Payload → UI Mapping) and Observation #1 (Earnings are NOT in this payload).

---

## 2. Order number: payload field vs on-screen "Order #"

**Claim under review.** Sample payload has `orderNumber: 173847`. Expanded screenshot shows "Order #100373735". The two are from different captures, so direct comparison isn't valid — but we still don't know which payload field actually drives the on-screen string.

**Open questions:**
- Which field does the mobile app render as "Order #..."? Candidates: `orderNumber`, `orderId` (UUID), an external display ID delivered elsewhere, or a derived value.
- Is "Order #100373735" the merchant-facing order ID or an internal one?

**How to verify.**
- Search the iOS / Android codebases for the literal "Order #" or its localization key.
- Cross-reference to the data model field bound to that label.

**What to update.** Observation #6 in `courier-offer-system-architecture.md`.

---

## 3. UI distance value (7.7 km) vs raw `distance` fields

**Claim under review.** The two `distance` fields in the JSON sum to 6.4 km. The screenshot shows 7.7 km. The architecture doc hypothesizes the UI uses route distance from a mapping service.

**Open questions:**
- Is the "7.7 km" string computed on mobile (route lookup at render time) or delivered server-side in a different field?
- If server-side, which field carries it? (Doesn't appear in `sample-offer-payload.json`.)

**How to verify.**
- Search mobile rendering code for the distance/km string formatter.
- Check `courierPayParameters.deliveryEstimates` and any pay/bonus response fields for a distance-like value.

**What to update.** Observation #3 in `courier-offer-system-architecture.md`.

---

## 4. Current p95 latency: actually 180ms?

**Claim under review.** Both architecture and hybrid-design docs cite "currently 180ms p95" against a 200ms SLA, leaving ~20ms of headroom for new on-path work in the hybrid design.

**Open questions:**
- Is the 180ms figure current (last 30 days) or aspirational?
- Where is the metric measured (SQS publish? AppSync push to mobile? end-to-end with mobile ack?)?
- Is 180ms steady or does it spike at the 2M offers/hour peak?

**How to verify.**
- Pull the relevant Datadog / Grafana dashboard for `courier_offer_service` p95 over the last 30 days at peak.
- Reconcile measurement endpoint with the 200ms SLA definition.

**What to update.** Performance Constraints section in `courier-offer-system-architecture.md`, and the Latency Budget table in `hybrid-end-to-end-design.md`. If the real number differs, the hybrid latency table needs to be re-baselined.

---

## 5. App version detection for dual-payload routing

**Claim under review.** `hybrid-end-to-end-design.md` Phase 2 sends both legacy and modular payloads, and Phase 4's payload builder branches on app version to pick the format. The doc currently says "detects app version from courier context" without specifying the source — I added a placeholder note that this needs verification.

**Open questions:**
- Is there an existing `clientVersion` (or similar) field flowing into `courier_offer_service`? Possible sources: courier profile API, JWT/auth token claim, an HTTP header carried via `JobSummaryUpdated`, or a value pushed via `courier_mobile_async_service`.
- If none exists, who owns adding it, and where in the call chain?

**How to verify.**
- Inspect `JobSummaryUpdated` schema in `temporal_multiverse` / Courier Management for a client/app version field.
- Check the `SendCourierMobileEvent` DTO and AppSync subscription headers.
- Talk to mobile platform leads about what's already exposed.

**What to update.** Component #4 (Offer Payload Builder) in `hybrid-end-to-end-design.md`, and the Phase 2/3 dual-payload steps.

---

## 6. Acceptance rate source

**Claim under review.** `courier-offer-system-architecture.md` Observation #5 says "Acceptance rate / progress bar — NOT in this payload. Comes from a separate courier profile/stats call." The hybrid design includes `acceptance_rate` as a component fed from `topUpPromotion.currentAcceptanceRate` / `requiredAcceptanceRate`.

**Open questions:**
- Is acceptance rate authoritatively in (a) Courier Bonus' `topUpPromotion`, (b) a separate courier profile/stats service, (c) both, or (d) computed on mobile from local history?
- For the hybrid design, where should the `acceptance_rate` component pull from at offer-assembly time?

**How to verify.**
- Read `domain/offer/AbstractOfferService.sendOfferWithPayBonus()` to see what fields are available alongside pay/bonus.
- Check `CourierBonusServiceClient` response shape.
- Search mobile for the acceptance-rate progress bar and confirm whether it pulls from the offer payload or a separate API.

**What to update.** Observation #5 in `courier-offer-system-architecture.md`, and Component Registry data sources in `hybrid-end-to-end-design.md`.

---

## 7. Calgary screenshots — are they reproducible from a CA `JobSummaryUpdated`?

**Claim under review.** The two screenshots in this folder show CA (Calgary) test data, while `sample-offer-payload.json` shows CH (Bern) test data. The architecture doc's UI mapping uses the screenshots' visible values for clarity but doesn't have a matching CA payload to point at.

**Open questions:**
- Can a CA-side capture be exported (real `JobSummaryUpdated` and the corresponding `SendCourierMobileEvent.data` for the same offer) so the mapping table is grounded in one self-consistent example?

**How to verify.**
- In a non-prod environment, capture both events for a single Calgary test offer and add them as `sample-offer-payload-ca.json` (and the post-pay variant).

**What to update.** "Note on sources" callout in `courier-offer-system-architecture.md`. If a CA payload is captured, the UI mapping table can be redone field-for-field against it.

---

## 8. Component data-shape governance

**Claim under review.** `approach-evaluation.md` now flags that "forward compatible" only covers new component types, not field changes within an existing component, and that a registry needs versioned data contracts. `hybrid-end-to-end-design.md` doesn't yet specify how component schemas will be versioned.

**Open questions:**
- Is there an existing pattern for cross-platform schema versioning (e.g., shared TypeScript / Kotlin / Swift codegen, GraphQL schema registry)?
- Who reviews additions/changes to the component registry? (Backend lead? Mobile lead? A formal review board?)

**How to verify.** Discuss with backend + mobile leads. May not be in code yet.

**What to update.** Add a "Governance" subsection to `hybrid-end-to-end-design.md` once the policy is decided.

---

## How to use this list

For each numbered item:
1. Verify the claim against the relevant repo / dashboard / doc.
2. Update the referenced doc with the confirmed answer.
3. Strike the item here (or remove it) and link to the commit that made the fix.

If verification reveals a *different* answer than the doc's current hypothesis, prefer fixing the doc to match reality over fitting reality to the doc.
