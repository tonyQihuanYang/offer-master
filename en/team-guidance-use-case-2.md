# Team Guidance: Real-time Fraud Detection (Use Case 2)

> 中文版本：[`team-guidance-use-case-2.zh.md`](../zh/team-guidance-use-case-2.zh.md)
>
> **Interview prompt being addressed:**
> A 4-engineer team (2-3 yrs experience each) building real-time fraud
> detection on Kafka + Flink. 45s processing delays vs <5s target, scope
> creep (3 → 12 patterns), data-quality unknowns, no clear test strategy,
> sprint review in 3 days with nothing to demo, low morale. Staff
> engineer's role: provide technical guidance **without doing the work for
> them**, working *with* the Tech Manager (not replacing them).

This doc is structured as the kind of artifact a Staff engineer would draft
before walking into the situation. It addresses all five assessment areas
from the prompt (Diagnostic, Guidance Strategy, 3-day plan, Long-term
development, Working with TM/Principals) plus the meta-question the prompt
is really testing: *can this candidate be a force-multiplier without taking
over?*

---

## The principle

**The crisis is the deadline, not the architecture.** The team has 3 days
and nothing to demo. The biggest temptation — and the most common Staff
failure mode — is to walk in, redesign the architecture, write the
critical-path code, and "save" the sprint. That solves the demo and breaks
the team. They learn that when things go wrong, a Staff engineer arrives
and bypasses them.

The right move is the harder one: **buy time, narrow scope, coach
diagnostically, and let the team ship something they understand.** The
architectural questions (is Flink the right tool? is the data model
correct?) get answered *after* the sprint review, not before.

The other principle, equally important: **the engineer who wants to "start
over with a simpler approach" might be right.** A Staff engineer takes that
suggestion seriously instead of dismissing it as "we already invested in
Flink." Sometimes the simpler approach really is correct, and recognizing
that early is part of the job.

---

## What "Staff role" means here vs the Tech Manager

This question is on the prompt explicitly, and getting the boundary right
is half the answer.

| Concern | Tech Manager owns | Staff Engineer owns | Joint |
|---|---|---|---|
| Sprint scope, deadlines | ✓ | | Help TM make the technical case |
| Stakeholder negotiation (PM, leadership) | ✓ | | Provide technical framing |
| Individual performance, careers | ✓ | | Provide technical signal/context |
| Team morale | ✓ | | Surface technical-frustration causes |
| Architecture | | ✓ | |
| Testing strategy | | ✓ | |
| Knowledge transfer / mentorship | | ✓ | TM resources it |
| RFCs, design reviews | | ✓ | |
| Sprint review messaging | | | ✓ Both shape the narrative |
| Escalation handling | | | ✓ Brief leadership jointly |

The trap to avoid: **stepping into the Tech Manager's role** (negotiating
with PM, making scope calls unilaterally, addressing morale by fiat). The
TM has authority you don't; using their authority without coordinating
undermines them and confuses the team.

The complement: **letting the TM make technical calls in your absence.**
Architecture decisions during this crunch should run through you, not be
decided in a Slack DM between TM and PM.

The first 30 minutes of any engagement here is a 1:1 with the Tech Manager
to draw exactly this line.

---

## Question 1 — Diagnostic & Assessment

Goal: surface the actual root causes without leading the witness. The team
will give you symptoms ("Flink is slow"); your job is to ask the questions
that turn symptoms into causes.

### Architecture diagnostics (the 45s problem)

| Question | What it surfaces |
|---|---|
| "Walk me through the data flow end-to-end on a whiteboard." | Reveals whether the team has a shared mental model. Often they don't. |
| "Where exactly is the 45 seconds being spent — is that ingest, processing, sink, or something else? Is it measured or inferred?" | Forces measurement before optimization. Many "Flink is slow" diagnoses are actually "we're blocking on a synchronous DB call inside an operator." |
| "What's your peak event rate per partition? What's your parallelism setting?" | Catches under-parallelized hot keys, which is the #1 cause of streaming latency. |
| "What's your watermark / event-time strategy? Are late events buffering up?" | Catches event-time misconfigurations that look like processing delay. |
| "Are any operators doing I/O — DB lookups, HTTP calls? If so, sync or async?" | Catches blocking I/O, which is a Flink anti-pattern. |
| "What does your checkpoint duration look like? Are you backpressured?" | Catches checkpoint storms and backpressure cascades. |
| "Is Flink even the right tool for our actual event rate? Have you measured it?" | The big one. At 50K couriers × ~30 deliveries/day = ~1.5M events/day = ~20 events/sec average, ~100/sec peak. Flink is designed for 100k+ events/sec. The team may be paying a complexity tax for capacity they don't need. |

### Scope diagnostics (the 3 → 12 patterns problem)

| Question | What it surfaces |
|---|---|
| "Of the 12 patterns, which 3 do stakeholders most want this quarter?" | Forces prioritization that hasn't happened. |
| "Who decided each new pattern would ship in *this* sprint? When was that decided?" | Often surfaces that decisions were made in 1:1s without team buy-in. |
| "What's the cost of *not* shipping pattern N this sprint vs next sprint?" | Most "must have" patterns aren't. |
| "If we shipped only the original 3, would the system still deliver the headline business outcome?" | Usually yes. The other 9 are nice-to-have dressed as critical. |

### Data quality diagnostics

| Question | What it surfaces |
|---|---|
| "What % of events have incomplete location data? What's the distribution by courier / by city?" | Bounds the problem. "Some" is unactionable; "12% of CH events" is. |
| "What does 'incomplete' mean — null field, default value, stale, missing entirely?" | Different failure modes need different mitigations. |
| "Is the upstream source fixable, or are we stuck handling it downstream?" | Decides whether this is a "fix once" or "handle forever" problem. |
| "What's the right behavior when location is missing — drop the event, mark it suspicious, route to a deadletter, hold it for late arrival?" | Surfaces unstated business rules. |

### Testing diagnostics

| Question | What it surfaces |
|---|---|
| "How do you test a fraud rule today, end-to-end? Show me." | Often reveals there's no fixture set, no replay capability. |
| "Do you have a corpus of known-fraud and known-clean events?" | Without a labeled dataset, you can't measure precision/recall. |
| "What's the feedback loop time when you change a rule? Seconds, minutes, hours?" | Long feedback loops kill iteration speed. |
| "Have you written a single integration test that runs the rule against a fixed input and asserts on output?" | Surfaces the gap honestly. |

### Team / morale diagnostics

These are best handled with the TM, but you'll need answers to guide
technically:

| Question | Where to ask |
|---|---|
| "What's each engineer individually feel blocked by?" | Ideally TM does 1:1s; if not, brief group "what's hardest right now" |
| "The engineer who wants to 'start over' — what specifically would they build differently?" | Direct conversation. They have a perspective worth hearing. |
| "What did the team feel was the original definition of done for this sprint?" | Usually different from PM's current definition. Write down both. |

### Crucial Staff move: ask progressively

Don't fire all 30 questions at once. Ask them in waves:

```
Wave 1 (15 min): "Walk me through what you've built and where it's stuck."
Wave 2 (after listening): targeted follow-ups on the 1-2 things they said
Wave 3 (after the meeting): individual 1:1s with the engineer who wants to
                            restart and the engineer who's most stuck
```

The questions are diagnostic instruments. Used correctly, they show the
team how to think, not just what to think.

---

## Question 2 — Technical Guidance Strategy (without solving)

The hardest part of this case. The instinct of any senior engineer in this
situation is to fix it themselves — they can see the answers. The Staff
move is to make the team see the answers.

### Patterns that work

| Technique | What it looks like |
|---|---|
| **Pair, don't solve** | Sit next to the engineer debugging. Ask "what does the metric say?" "what would happen if you doubled parallelism here?" Let them drive the keyboard. |
| **Whiteboard principles, not solutions** | "Let's draw what backpressure looks like in this system" → not "the fix is to add a Kafka topic between operators." |
| **Code review as teaching** | Comments are *questions*: "what happens if this map is null?" not "add a null check." |
| **Help them write the RFC** | They write the doc. You comment with questions. The doc becomes durable artifact and skill development. |
| **Bring in second opinions** | Schedule a 30-min review with a Principal who knows streaming. Make the team present, not you. |
| **Reading list, not summary** | Designing Data-Intensive Applications ch.11 (Stream Processing); Streaming Systems by Akidau ch.1-3; Flink's "Concepts" docs. Read together, discuss in next session. |
| **External voice for sensitive things** | If the architectural mismatch with Flink is real, sometimes the team accepts that conclusion better when they reach it themselves after a workshop, not when you tell them. |

### Patterns that fail

| Anti-pattern | Why it fails |
|---|---|
| **Writing the fix yourself** | Solves the demo, breaks the team. They learn you're the answer machine. |
| **"Use X instead of Flink" delivered as a verdict** | They've spent weeks on Flink. A unilateral overrule reads as "you wasted our time." |
| **Long lectures on streaming theory** | At 2-3 yrs of experience, they've been talked at plenty. They learn by doing. |
| **Refusing to give any direct answers** | The opposite failure. If they ask "is checkpoint duration usually measured in ms or s?" — answer "ms typically." Withholding facts is not coaching. |
| **Public correction in front of stakeholders** | Erodes trust. Correct in private; praise in public. |

### A worked example: the 45s latency

Engineer: *"How do I fix the 45-second latency?"*

**Senior answer**: "It's probably backpressure. Add async I/O to the
operator and double the parallelism on the keyed stream."

**Staff answer**: "What does the latency breakdown look like — which step
is slowest?" → (engineer answers) → "What does the metric say is happening
at that step?" → (engineer hypothesizes) → "How would we confirm that
hypothesis?" → "OK, let's run that experiment. What would the result tell
us?"

Same destination, different journey. The Staff version teaches the
debugging method; the Senior version teaches the symptom-fix mapping.

---

## Question 3 — The 3-Day Immediate Action Plan

The single most important Staff move in this section: **decide
ruthlessly what's demo-able and lock the rest out of scope.** The team's
problem isn't that they can't ship 12 patterns; it's that they're trying to
ship 12 when 1 would tell the story.

### Day 1 (today)

**Morning (30-90 min)**

| Activity | Outcome |
|---|---|
| 1:1 with Tech Manager | Aligned RACI; agreed plan to descope; agreed who tells the PM |
| 60-min architecture walk-through with the team | Shared mental model; written list of bottlenecks (their list, not yours) |

**Midday (60 min)**

| Activity | Outcome |
|---|---|
| Scope-lock session with TM, team, and PM | One pattern in scope for the demo. Other 11 deferred. PM agrees in writing. |

This is the load-bearing decision of the 3 days. Pick the **simplest**
fraud pattern that still demonstrates the architecture: e.g., "courier
marked delivery complete >500m from destination." It needs:
- Location at delivery-complete event (already in the data).
- Destination location (already in the data).
- A distance calculation (trivial).
- Output to a sink (alert, table, log).

This is doable in <5 seconds end-to-end with or without Flink.

**Afternoon (rest of day)**

| Activity | Outcome |
|---|---|
| Pair on the demo path (engineer drives, you ask questions) | Day-1 working skeleton — even if it's slow, it works |
| Separately: write down the *post-demo* architectural concerns | Not for this sprint. Captured for the retrospective. |
| Set up "demo definition" doc with the team | One page: what we'll show, what we won't, why |

### Day 2

| Activity | Outcome |
|---|---|
| Continue pairing on the demo path | Tested end-to-end with a fixture |
| Write a tiny test fixture (5-10 events covering positive + negative) | First testable artifact — durable beyond the demo |
| Draft sprint review narrative with TM | Honest framing: "we hit unexpected complexity in [streaming + data quality], descoped intentionally, here's what works, here's the path forward" |
| Quiet 1:1 with the "start over" engineer | Hear them out. They likely have signal. Capture it for the retrospective. |
| Help TM with stakeholder pre-briefing | TM tells PM and senior stakeholders the new scope before the demo. No surprises in the room. |

### Day 3 (sprint review prep)

| Activity | Outcome |
|---|---|
| Dry run with the team — 30 min | They present, you watch. Iterate on framing. |
| Pre-brief Director (with TM) | Leadership hears the descope from engineering+TM, not from PM in the moment |
| Set up the post-demo retrospective for next week | Architecture revisit, scope discussion, knowledge gaps |

### The sprint review itself

You sit in the audience. The team presents. The TM owns the descope
narrative. You're there to support if there's an architectural question
that needs experienced framing — but the team gets the credit.

If leadership challenges the team in the meeting, you and the TM step in
together: "the descope was a deliberate engineering call, here's the
context, here's the path forward." Never let the team be alone with a
hostile escalation.

### What "demo-able" actually means

Three acceptable outcomes for the sprint review, in descending preference:

1. **Working streaming demo** of one pattern, end-to-end, sub-5s. Even if
   it's not at production scale.
2. **Batch demo** of one pattern with synthetic streaming framing — "we'll
   move to streaming next sprint, here's the detection working on a fixed
   dataset." Honest about the gap.
3. **Architecture review presentation** — "we discovered our architecture
   doesn't fit our actual data volume; here's what we propose for next
   sprint, here's why." This one is high-risk; only if 1 and 2 are
   genuinely impossible.

Avoid: a half-working streaming demo that fails live. The team will be
demoralized for weeks.

---

## Question 4 — Long-term Team Development (Knowledge Transfer)

This is what *prevents* the next 3-day crisis. Without it, you'll be back
in this room in two months.

### 30 days

| Activity | Cadence | Why |
|---|---|---|
| Streaming fundamentals study group | 2 hrs/week × 4 weeks | Shared vocabulary, baseline mental model |
| DDIA ch.11, Streaming Systems ch.1-3, Flink Concepts docs | Read between sessions | Self-study + group discussion = retention |
| External streaming engineer for 2 sessions (internal SME or paid) | 90 min each | Outside voice on common pitfalls |
| Architecture office hours | 1 hr/week | Regular forum for "how do I…" without crisis |

### 60 days

| Activity | Why |
|---|---|
| Each engineer builds a small Flink toy project (e.g., word count with windowing + late events) outside production | Hands-on confidence; safe space to fail |
| Team writes the v2 RFC for the fraud system, given what they've learned | Surfaces remaining gaps; rehearses RFC skill |
| Code-read a real Flink job from another team | Demystifies "production Flink code" |

### 90 days

| Activity | Why |
|---|---|
| Each engineer presents one streaming concept to the rest (windowing, watermarks, exactly-once, state, backpressure) | Teaching is the highest form of learning. They own it now. |
| Identify one engineer to be the team's streaming SME | Durable point of expertise inside the team |
| Pair the team with another team that has streaming experience for ongoing reviews | Network effect; less reliance on you |

### Crucial principle: don't make them learn in isolation

If your org has a team that runs production streaming systems, partner with
them — code reviews, joint architecture sessions, embedded engineer for a
month. **Knowledge transfer between teams is faster than in-team
self-study.** Your job as Staff is to broker that connection.

---

## Question 5 — Working with the Tech Manager and Principals

This is the question the prompt explicitly calls out. The boundary
diagram from the top of this doc is the framework. Here's how it plays out
in practice.

### With the Tech Manager (your peer)

**Cadence during the crunch:** daily 15-min check-in. After the crunch,
weekly 1:1.

**Standing agreements:**

| What | Agreement |
|---|---|
| Architecture decisions | Run through me; TM doesn't approve in my absence |
| Scope decisions | TM owns; I provide technical framing |
| Individual feedback to engineers | TM owns career conversation; I provide technical signal |
| Sprint review messaging | Drafted jointly, TM presents |
| Escalation to Director | Joint brief; we walk in together |
| Public criticism of decisions made before I arrived | Don't. Acknowledge constraints. Move forward. |

**What to avoid:**

- Going around TM to engineers with directives. Always loop TM.
- Letting engineers play TM and you against each other ("but Staff said…").
  Surface this immediately and shut it down.
- Taking credit for the team's recovery. The team recovers; you advise.

### With Principals (your seniors / peers depending on org structure)

**Use them for:**
- **Second opinions on architecture** — bring them in *early*, before
  decisions are locked.
- **Pattern-matching** — they've seen this kind of crisis before. Ask "have
  you seen a Flink-was-the-wrong-tool situation? How did it resolve?"
- **Modeling escalation behavior for you** — if you're uncertain about how
  to handle leadership, ask a Principal first.
- **Backstop for technically hard calls** — if the team or TM pushes back
  on your guidance, a Principal review confirms or corrects.

**Don't use them for:**
- Doing the work for you. They're a resource, not a heat shield.
- Going over your TM's head. Principals are for technical input, not
  political backup.

### With leadership (Director / VP, who PM is escalating to)

**Get ahead of the escalation.** Before leadership hears about the missed
sprint from a frustrated PM, you and the TM brief them jointly:

```
"Here's what we found: the team picked Flink for a workload that's
50–100× smaller than Flink's design point, and is now paying complexity
tax that's costing them shipping velocity. We've descoped the sprint to
ship one pattern; we're using next 30 days to formally evaluate whether
the architecture should change. The team will have a recommendation by
[date]. We'd like your air cover with the PM while we do this work."
```

Properties of a good leadership brief:
- **Honest about what went wrong** — but framed as engineering judgment,
  not blame.
- **Concrete timeline** — when leadership will hear next, what they'll
  hear.
- **Specific ask** — "air cover" is a real ask; "support" is not.
- **Joint** — TM and Staff together. Not one or the other.

---

## The hardest moments and how to navigate them

### Moment 1: An engineer asks you to "just write the fix"

Response: *"I can pair with you on it. Let's do it together — I'd rather
you understand it because you'll be on call for it."* Sit next to them.
They drive.

### Moment 2: TM proposes shipping all 12 patterns to keep PM happy

Response (to TM, in private): *"If we ship 12 half-working patterns, we'll
be back here in a month with a worse problem. I'd rather take the heat now
on descoping than take it later on quality. I'll back you up on the call
to PM."*

### Moment 3: PM asks you directly to commit to a date

Response: *"I want to give you a real answer. Let me sync with [TM] this
afternoon and we'll come back to you tomorrow with a date we can defend."*
Never commit a date in the moment, especially around a TM you're trying
to support.

### Moment 4: The team is demoralized and one engineer is about to quit

This is TM territory, not yours. Your role: surface what you observe to TM
("I noticed [engineer] seems checked out — wanted to flag it"); offer
technical-side support (pair more; reduce their load on the demo path).
Don't run a morale conversation — that's TM's job and the engineer needs
TM, not Staff, on this.

### Moment 5: The "start over" engineer turns out to be right

Worst case: you investigate and conclude Flink really is wrong. Now what?

This is actually a win for the team if framed correctly:
1. Praise the engineer publicly: "[engineer] called this out early — we
   should have engaged with it sooner."
2. Frame the Flink work as **not wasted**: it surfaced the data-quality
   issues, the scope problem, the actual event rate. Without that work,
   the team would have built v2 on the same wrong assumptions.
3. Own the learning: "in retrospect, we should have measured event rate
   before tool selection. That's a lesson for next architecture decision."

The team leaves the situation more capable, not less. That's what Staff
guidance produces.

---

## Anti-patterns to avoid

| Anti-pattern | Why it fails |
|---|---|
| **Walking in and rewriting the architecture** | Solves the demo, breaks the team. |
| **Blaming the team for tool choice** | They picked Flink because someone told them streaming = Kafka+Flink. The org's pattern library failed them, not the other way around. |
| **Refusing to commit to anything until "you have more data"** | At some point, you have to give technical guidance. Diagnosis without prescription is paralysis. |
| **Going over the TM's head to leadership** | Catastrophic for the working relationship. Even if you're right. |
| **Public corrections in the sprint review** | Public *praise*, private corrections. |
| **Treating the "start over" engineer as a problem** | They're providing data. Treat them as a peer. |
| **Pretending to know things you don't** | At Staff, "I don't know — let's find out" is a sign of strength. |
| **Saying yes to all 12 patterns to seem agreeable** | The team will silently fail and resent you for not having their back. |
| **Not writing things down** | The decisions you make in this room need to outlive the meeting. ADRs, RFCs, meeting notes. |

---

## Sample language for the meetings

**Diagnostic phase:**
- *"Help me understand — when you say Flink is slow, what specifically have
  you measured?"*
- *"What would convince you that Flink is the wrong tool? What would
  convince you it's the right tool?"*
- *"Of the 12 patterns, which 3 do you personally think are most
  important?"*

**Coaching:**
- *"What's your hypothesis about why this is happening?"*
- *"How would we test that?"*
- *"If you had to bet, what's the most likely cause?"*
- *"I can give you the answer, but I'd rather you find it — what would you
  try first?"*

**Boundary with TM:**
- *"That's a scope call — let me make sure [TM] is in this conversation."*
- *"I can speak to the technical risk; the prioritization decision is
  [TM]'s."*

**Boundary with engineers:**
- *"I'll pair with you, but you're driving."*
- *"I want you to own this — what do you need from me?"*

**Sprint review framing:**
- *"We descoped intentionally based on engineering judgment. Here's what we
  shipped, what we learned, and the path forward."*
- (To leadership, if challenged) *"This was the right call. I'd make it
  again."*

---

## The closing posture

The single sentence to land Use Case 2:

> *"My role here is to make the team better at this — not to do the work
> for them. The 3-day deadline is a constraint to navigate, not a
> performance to deliver. If I do my job right, this team will handle the
> next streaming project without needing a Staff parachute."*

That sentence captures the Staff distinction: **leverage over time, not
heroics in the moment.**

---

## Mapping to the prompt's five assessment areas

| Prompt question | Section in this doc |
|---|---|
| 1. What questions to understand root causes? | "Question 1 — Diagnostic & Assessment" |
| 2. How to guide without solving? | "Question 2 — Technical Guidance Strategy" |
| 3. What to do in the next 3 days? | "Question 3 — The 3-Day Immediate Action Plan" |
| 4. How to structure long-term knowledge transfer? | "Question 4 — Long-term Team Development" |
| 5. How to work with TM and Principals? | "Question 5 — Working with the Tech Manager and Principals" + the boundary table at the top |

Plus the meta-themes the prompt is testing:
- Staff vs Senior posture → "The principle" + "Anti-patterns"
- Working *with* TM, not replacing → "What 'Staff role' means here vs the Tech Manager"
- Force-multiplier vs firefighter → "The closing posture"

---

## Suggested 25-minute interview flow

| Time | Section | What to deliver |
|---|---|---|
| **0–3 min** | Frame | "The crisis is the deadline, not the architecture." Boundary with TM. |
| **3–8 min** | Diagnostic questions | Walk through the architecture / scope / data quality / testing / team buckets. Don't list all 30 questions — pick 2-3 from each bucket and explain *why* each is diagnostic. |
| **8–15 min** | 3-day plan | Day 1 / Day 2 / Day 3 / Sprint review. The descope and the demo definition are the load-bearing moves. |
| **15–18 min** | Guidance technique | The worked example (45s latency). The pair-don't-solve principle. |
| **18–22 min** | Long-term + knowledge transfer | 30/60/90 plan. Cross-team partnership. |
| **22–25 min** | Working with TM/Principals | The RACI. Joint leadership briefing. The "start over" engineer might be right. |

If asked "what's the architecture problem with Flink?" — answer briefly
(the event rate is 50-100× below Flink's design point, complexity tax),
then redirect to "but my job here isn't to declare it wrong; it's to help
the team measure and conclude that themselves."

---

## Related documents

- [`technical-leadership.md`](./technical-leadership.md) — companion doc for
  Use Case 1 on facilitating cross-team decisions. Same author posture
  applied to a different scenario.
