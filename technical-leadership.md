# Technical Leadership: Facilitating the Mobile Complexity Decision

> 中文版本：[`technical-leadership.zh.md`](./technical-leadership.zh.md)
>
> **Interview prompt being addressed:**
> "The mobile team is concerned about Approach B increasing their complexity.
> How do you facilitate this decision?"

This is **not** a technical question. It tests whether the candidate behaves
like a Staff engineer (facilitates a decision across teams) or like a Senior
(advocates the technically "correct" answer). The mobile team's concern is
legitimate and the answer must treat it that way.

This doc is written as the kind of artifact a Staff engineer would produce
*before* the conversation — both to organize their own thinking and to share
with the mobile team as a starting point for the meeting.

---

## The principle

**Validate the concern, then sharpen it.** The mobile team is right that
Approach B increases their complexity. The right question isn't *whether* —
it's *by how much, what kind, and what's on the other side of the trade*.

Decisions made by overruling another team's expertise tend to come back as
attrition or as quiet non-cooperation during the rollout. Decisions made by
ignoring trade-offs in favor of consensus tend to ship the worst of both
options. The Staff engineer's job is to drive a decision that's defensible
on the merits and durable across the teams that will live with it.

---

## Seven-step facilitation playbook

### Step 1 — Acknowledge the concern explicitly, in writing

Before the meeting, reply to whatever channel the concern was raised on:

> *"You're right that Approach B shifts complexity onto mobile. I want to
> dig into the specifics — how much, what kind, and what we'd be giving up
> on the other approaches — so we make this decision with eyes open. I'll
> set up a working session this week."*

This costs nothing and changes the frame from "us vs mobile" to "us
together vs the problem." It also means the meeting opens with a shared
premise rather than re-litigating whether the concern is valid.

### Step 2 — Schedule a working session with both leads (not a presentation)

Attendees: backend lead (you), mobile lead, mobile platform engineer who
would actually do the work. **Not** the PM, **not** the manager, **not** an
audience. Decision-quality conversations don't happen in front of an
audience.

Time-box to 60 minutes. Agenda agreed in advance:

```
1. Restate the problem and constraints (5 min)
2. What "complexity" specifically means for mobile (15 min) — mobile drives
3. The four trade-off dimensions (20 min) — you drive
4. Concrete mitigations (10 min) — both
5. Decide on a small proof, or escalate (10 min)
```

Order matters. Letting mobile articulate the cost first — before you pitch
mitigations — is what makes them feel heard.

### Step 3 — Sharpen what "complexity" means

Mobile teams say "complexity" to mean different things. Push for specifics:

| Possible meaning | Counter-question to ask |
|---|---|
| "More code on mobile" | How much, in LOC or files? Is that the binding constraint? |
| "More logic to test" | What's currently untested today? Would the new layer be more or less testable? |
| "More platform-specific work" | iOS and Android both, or one more than the other? |
| "More coordination with backend" | More than the current 22-field offer payload coordination already requires? |
| "Risk of inconsistency between iOS/Android" | Real concern — flag for explicit mitigation |
| "Performance / app size" | Quantifiable — measure it |
| "We don't have the headcount" | Different kind of concern — talk to managers |

Until you know which one(s) drive the concern, you can't address it. A
common Staff failure mode is to defend against a generic "complexity" claim
without finding the specific worry under it.

### Step 4 — Reframe around four trade-off dimensions

Don't argue Approach A vs B. Argue the dimensions both approaches affect, and
let the team see where each lands:

| Dimension | Approach A (DSL) | Approach B (raw + mobile) | Approach C (Hybrid) |
|---|---|---|---|
| **Mobile complexity** | Lowest — generic interpreter | Highest — full presentation logic | **Medium — bounded component registry** |
| **Backend complexity** | Highest — DSL engine | Lowest | Medium — layout composer |
| **Native UX quality** | Poor (DSL can't express native interactions) | Excellent | Excellent |
| **Experiment velocity** | High (server-only) | Low (app release per change) | **High for layout, low for new components** |
| **iOS/Android consistency** | Guaranteed (same bytes) | Hard | Enforced by shared component spec |
| **Latency at 2M/h** | Heavy server compute | Light | Light |
| **Hiring market fit** | Niche (custom DSL is unique) | Standard mobile work | Standard with one team contract |

The point of this table: mobile's concern targets one cell. Looking at the
full grid usually surfaces that pure A is worse for them in other ways
(can't express native interactions; locks them out of UX decisions), and
pure B has costs the *backend* team carries (every layout experiment is
gated on app release).

### Step 5 — Present the bounded-complexity mitigations

The big lever for accepting the mobile-side cost is **bounding** it. List
concrete mitigations and ask which would change the calculus:

| Mitigation | Effect on mobile complexity |
|---|---|
| **Locked component registry** (~10–15 components, additions go through both teams) | Surface area is finite, not open-ended |
| **Shared schema → codegen** (one source emits Kotlin + Swift data classes) | No manual parsing, no drift |
| **Forward-compat skip** (unknown components render as nothing) | Mobile can be ahead or behind server safely |
| **Component reuse** (one component reads many earnings models) | Adding a model = backend change only |
| **Snapshot tests + integration tests** (jointly owned fixture set) | Visual regression catches contract drift |
| **Co-owned RFC process for new components** | Mobile is a co-author, not a consumer |
| **Hybrid app-version awareness** | Old apps see fallback layout — no forced release schedule |

Each of these is a real engineering investment, not a slogan. The honest
framing: *"Mobile takes on a bounded amount of new complexity. The bounds
aren't free — they're the artifacts I just listed. Are those the right
bounds?"*

### Step 6 — Propose a proof, not a vote

Cross-team architectural decisions almost never benefit from a vote. They
benefit from a small, real piece of evidence. Propose:

> *"Let's prototype the hybrid pattern on **one zone** (e.g., Switzerland —
> ~1,500 couriers, contained blast radius), **one component** (earnings),
> and measure mobile's actual time-cost over **four weeks**: hours
> implementing, hours debugging, perceived friction. If it's worse than
> projected — by your judgment — we revisit. If it's in line, we expand.
> Either way we'll have data instead of opinions."*

Properties of a good proof:
- **Reversible** — can be undone with a config flip.
- **Bounded** — small zone or small component, not the whole system.
- **Time-boxed** — explicit "we decide again on date X."
- **Measured** — agreed criteria for "worked" / "didn't work" *before*
  starting, not after.
- **Owned by the team raising the concern** — mobile leads the prototype.
  This is critical: it removes "you're forcing this on us" as a frame.

### Step 7 — Have an explicit escalation plan

If the working session doesn't produce alignment, the next step is
documented and predictable:

1. Both leads write a one-page position summary (not a Slack thread —
   one shared doc with both views, ~500 words each).
2. The doc goes to the next-level group: Principal engineers and the
   directors of the two teams.
3. They make the call within a defined window (e.g., 5 working days).
4. The decision is captured as an ADR (Architecture Decision Record) so
   future joiners know what was decided and why.

Stating this *up front* — "if we can't align in this room, here's how we
escalate" — makes the meeting safer for both sides. Mobile knows their
concern won't be steamrolled; backend knows the decision won't be deferred
indefinitely.

---

## Concrete artifacts to produce

A Staff-level facilitation produces written artifacts, not just meetings.
For this decision, the durable record should include:

| Artifact | Purpose | Owner |
|---|---|---|
| **ADR (Architecture Decision Record)** | Capture the decision, the alternatives considered, the rejected options, and the reasons | You (drafted), both teams (approved) |
| **Component registry charter** | Names the registry, its scope, who can add to it, the review process | Both teams jointly |
| **Mobile complexity bound document** | The list of mitigations from Step 5, made into a checklist mobile signs off on | Mobile lead |
| **Prototype scoping doc** | Zone, component, duration, success criteria, measurement plan | Mobile lead, you review |
| **Migration plan with tripwires** | Phased rollout, rollback triggers, gate criteria — see `hybrid-end-to-end-design.md` | You |

**Why writing matters:** the people who weren't in the meeting (future
hires, the PM, leadership) will all be affected by this decision. The
written artifact is what they'll read. If it doesn't exist, the decision
will get re-litigated every six months when someone new asks "wait, why
did we do it this way?"

---

## Anti-patterns to avoid

These are the failure modes that signal Senior thinking, not Staff:

| Anti-pattern | Why it fails |
|---|---|
| **"Mobile teams at Uber/Lyft do this, so should we"** | Industry references support an argument; they don't replace one. Mobile lead's response: "we're not Uber" — and they're right. |
| **Pre-writing the decision and presenting it for approval** | Mobile knows. Trust collapses. The session becomes performative. |
| **"Backend can't deploy for every UI change — it's not sustainable"** | Real concern, but framed as backend's problem, not the system's. Sounds self-interested. |
| **Conceding to pure Approach B to avoid conflict** | Optimizes for the meeting, not the system. The team is shipping the project, not winning it. |
| **Endless discussion without a forcing function** | Decisions decay. Without a "by date X we ship the proof or escalate" clause, the conversation becomes the decision. |
| **Treating the mobile team as a downstream consumer of the registry** | They're not. They're a co-author. If they don't have edit rights to the registry contract, they correctly perceive Approach B as a backend imposition. |
| **Bringing leadership into the room "to settle it"** | Premature escalation. Save leadership for after the working session, not in place of it. |
| **Defending Approach C as "the right answer" without engaging with mobile's specific worry** | If you can't articulate the worry, you can't address it. |

---

## When alignment fails

Sometimes the working session ends without a clear decision. That's fine —
**not deciding in the room is better than forcing a fake consensus**. The
escalation path from Step 7 kicks in:

1. Both sides write a one-page position. The constraint of writing surfaces
   the actual disagreement (often it turns out to be smaller than the room
   suggested).
2. Principal/Director review with a clock.
3. ADR captures the outcome and the dissenting view.

A Staff engineer can advocate strongly for one option and still gracefully
accept being overruled if the higher-level decision goes the other way.
That's part of the job. What's not part of the job: dragging the decision
out, slow-rolling implementation, or re-opening it after it's made.

---

## How this generalizes

The shape of this answer applies to most cross-team architectural decisions:

```
1. Validate the concern in writing                    (signal: we hear you)
2. Working session, not presentation                  (signal: you have a voice)
3. Sharpen vague concerns into specific dimensions    (signal: rigor)
4. Reframe around shared trade-offs, not approaches   (signal: not adversarial)
5. Bound the cost with concrete mitigations           (signal: engineering, not slogans)
6. Propose a small reversible proof                   (signal: evidence, not opinion)
7. Pre-state the escalation path                      (signal: this won't drag)
```

The specific pattern you'd defend changes (hybrid SDUI here, but it could
be a service split, a database choice, a programming-language migration).
The facilitation pattern is the same.

---

## Sample language for the working session

Phrases that signal Staff facilitation:

- *"You'd know better than me — what part of this would actually be
  expensive on iOS specifically?"*
- *"I want to make sure I'm steel-manning your concern. Is this
  fundamentally about LOC, about iOS/Android divergence, about coordination
  cost, or about something else?"*
- *"Here's what I'd give up if you can show me data: a hybrid where layout
  changes still go through an app release. What would you need to see to
  agree the bounded version is workable?"*
- *"The thing I'd want both teams to agree on, before we leave this room,
  is the size of the component registry and the review process for adding
  to it. Can we lock that?"*
- *"If we can't agree today, that's fine — let's both write a page and
  send it to [Principal] by Friday. I'll draft the ADR template."*

Phrases to **avoid**:

- "I think you're overestimating the complexity." (Telling, not asking.)
- "This is what the industry does." (Authority appeal.)
- "Trust me, this'll work out." (Worst possible framing.)
- "If you don't agree, we'll have to escalate." (Threat, even if true.)
- "We can revisit this later if it doesn't work." (No accountability.)

---

## The closing posture

The single sentence to land Use Case 1's leadership question:

> *"My job here isn't to win the architecture argument — it's to make sure
> the team that ships and maintains this thing is a co-author of the
> decision, with the cost honestly bounded and the trade-off honestly
> stated. Approach C is what I'd advocate, but I'd rather ship Approach B
> with mobile fully bought in than ship Approach C with mobile compliant
> but quietly resentful."*

That sentence, delivered at the end of the leadership section, is what
separates a Staff answer from a Senior answer. It says: I will defer to
people-level outcomes when the system-level outcomes are close.

---

## Related documents

- [`approach-evaluation.md`](./approach-evaluation.md) — the technical
  comparison the working session would reference.
- [`hybrid-end-to-end-design.md`](./hybrid-end-to-end-design.md) — the
  proposed architecture, including bounded mobile complexity (component
  registry charter implicit) and migration phases.
- [`app-version-compatibility.md`](./app-version-compatibility.md) — one of
  the mitigations: mobile can be ahead/behind server safely, removing the
  forced-release-schedule complexity from mobile's worry list.
- [`handOver.md`](./handOver.md) — open verification items, including
  governance of the component registry which mobile must co-own.
