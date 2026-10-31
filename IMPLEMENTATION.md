# PS 02 implementation — phase by phase

Solo track: content first, pure functions second, UI last, dashboard when the loop is real. Each phase is one commit;
tick here and log in [../docs/STATE.md](../docs/STATE.md). `STATUS: current` marks where the track is.

The gates below are the ones A1 checks at the H4 cross-help review, so be honest with yourself about them early.

---

## T0 · Content assets — H0:30–2:00 (inside the shared-platform phase) — `STATUS: pending` · **highest priority**

Files: `content/physics/graph.json`, `bank.json`, `misconceptions.json`, plus `prompts/physics.items.md`
(BUILD-time generator prompt, [PROMPTS.md §1](PROMPTS.md)).

Build
1. `misconceptions.json` — the 12 tags from [ARCHITECTURE.md §2](ARCHITECTURE.md), each with `conceptIds`,
   `correctPrinciple`, `remediationHint`. This file gates everything else: the classifier's closed set and the bank's
   tags both come from it.
2. `graph.json` — 5 chapters → ~24 concepts with prereq edges. Hand-drawn from the syllabus, ~20 minutes; do not let
   a model invent a physics dependency tree.
3. `bank.json` — ~40 items: 2–3 concepts covered per difficulty band, every item with `reasoningPrompt` and at least
   one `misconceptionTag` it is diagnostic for. Generate with the prompt, then **verify every item by hand** — a
   physics error on camera is worse than four fewer questions.
4. Add `npm run validate:content`: schema check, every `conceptId` exists, every tag exists, every item has a
   reasoning prompt, no item tagged to more than 2 concepts.

**Gate:** validator green; 24 concepts; ≥40 items; ≥8 items belong to the two chapters the demo uses.
**Exit:** the file exists and loads into the store via `npm run seed`. This is the phase to finish before UI exists.

## T1 · Learner model — H2:00–2:30 — `STATUS: pending` · ladder 1 · kill check 5

Files: `lib/mastery.ts`, `lib/mastery.spec.ts`

Implement `pCorrect`, `updateMastery`, `clamp` exactly as [ARCHITECTURE.md §3](ARCHITECTURE.md) specifies, then the
six property tests named there (easy-correct small gain, hard-correct large gain, easy-wrong large drop, bounds,
convergence, monotonicity). Multi-concept split `ALPHA / conceptIds.length`.

**Gate:** `npm test` green with those six assertions passing.
**Exit:** the same functions run from a `node -e` snippet producing a sensible trajectory over 10 simulated answers —
this is what makes the demo claim safe even if the UI slips.

## T2 · Targeted selection + calibration — H2:30–3:30 — `STATUS: pending` · ladder 1 · kill check 6

Files: `lib/selection.ts`, `lib/selection.spec.ts`, `components/QuestionCard.tsx`, `components/MasteryStrip.tsx`,
`/tutor` route

Build
1. `nextQuestion` per [ARCHITECTURE.md §4](ARCHITECTURE.md): weakness term, difficulty band fit, prereq readiness,
   SRS due bonus, misconception revisit bonus, recent-answer exclusion.
2. The test the demo depends on: set `elec:series-circuits` mastery to 0.3, leave others high ⇒ the top-ranked item is
   tagged to it. A second test asserts band tracking: mastery 0.8 ⇒ difficulty 3 item ranks above difficulty 1.
3. Wire the answer loop in the UI: submit → `updateMastery` → store put → select next → render. `MOCK_LLM=1` path for
   classification so the loop closes without network.
4. `MasteryStrip` in the document margin — nodes tick down/up with animation off (reduced-motion), value visible.
5. Provenance footer on each question: "targeted `elec:series-circuits` · mastery 34% · difficulty 1".

**Gate:** both selection tests pass. **Exit:** answering wrong on screen changes a visible number and the next
question cites the concept you just lost. This is the loop; it must exist before anything else gets built.

## T3 · Spaced repetition — H3:30–4:15 — `STATUS: pending` · ladder 3

`lib/srs.ts`: Leitner transitions `[1,3,7,21,60]`, wrong ⇒ drop two boxes, misconception ⇒ box 0 + `remediation` flag,
`due(now)`. Render as "revision due today" under the active question, and expose `srsDue` into T2's scorer.
Test: one correct answer at box 0 ⇒ `due(now+2d)` empty, `due(now+7d)` contains it; wrong ⇒ due tomorrow.

**Gate:** the queue changes after a single answer. **Exit:** cheap and it is a named requirement; keep it small.
Cuttable at H5:45 only if T4 has slipped — T2 already consumes the `srsDue` term, so removing the UI line is a
30-second cut, not a refactor.

## T4 · Misconception detection — H4:15–5:15 — `STATUS: pending` · ladder 2 · kill check 7

Files: `lib/misconception.ts`, `tutor.classify` prompt + mock, `components/RedPenCard.tsx`

Build
1. `classifyReasoning({item, studentText})` — closed-set: the prompt receives only the taxonomy entries whose
   `conceptIds` intersect the item, so the model chooses among ≤5 candidates instead of 12.
2. `confidence ≥ 0.55` ⇒ red-pen card; below ⇒ "not sure, walk me through it again" and no tag.
3. Card renders `quote` (the student's own words), `correctPrinciple`, `remediationHint`. The quote is mandatory — a
   card without it reads as a canned response.
4. On fire: `updateMastery` with the misconception penalty, and `tutor.misconception` fact written for the dashboard.
5. `MOCK_LLM` responses for the three scripted demo reasonings, so the video never depends on a model's mood.

Tests: a `m:current-consumed` reasoning string classifies to that tag with the fixture bank item; a correct reasoning
returns `none`; a careless wrong answer returns `none` and still drops mastery.

**Gate:** the card fires on the scripted text and quotes it. **Exit:** if classification is unreliable at H5:15,
narrow the closed set to the 6 tags the demo actually uses — a smaller honest set beats 12 flaky ones.

## T5 · Teacher dashboard — H5:15–6:00 — `STATUS: pending` · ladder 4 · kill check 8

Files: `lib/cohort.ts`, `/tutor/teacher` route, reuse `Heatmap` from `@/platform/ui`

`simulateClass(20, seed)` per [ARCHITECTURE.md §8](ARCHITECTURE.md): three archetypes + noise, replay ~40 answers
through the real `updateMastery`, write under a cohort namespace. Dashboard = heatmap (concepts × learners), gap
ranking, top-5 misconception bars, at-risk list, student drill-down via `FactList`.

Test: `simulateClass` is deterministic for a fixed seed, and a learner whose true logit is low ends with estimated
mastery < 0.5 on ≥60% of their concepts — proves the model tracks reality rather than producing noise.

**Gate:** heatmap renders with no hardcoded numbers anywhere in the component tree. **Exit:** if T2/T4 are not green,
this phase is skipped entirely rather than mocked (floor condition).

## T6 · Diagnostic — only if H5:45 arrives with T1–T4 green — `STATUS: optional`

`lib/diagnostic.ts` running 8 items through the same `updateMastery` with `ALPHA * 1.4`, plus a start-screen entry.
If it doesn't fit, label the first five session questions as the check and delete the separate mode — the model path is
identical, so nothing downstream notices.

## T7 · Demo mode — H6:30–9:30 — `STATUS: pending`

Per [DEMO.md](DEMO.md): `npm run seed`, three clean mock-mode replays, one live, `/tutor/graph` populated, narration
dictated, screenshots unedited. No new features, no "one more concept".

## Standing guards for this track

- The model is the product. A prettier UI with a weaker `updateMastery` is a worse submission.
- Never fabricate mastery numbers in a component, and never ship a dashboard value that isn't model output.
- Physics correctness is not negotiable: verify every bank item by hand, including distractors, and keep the wrong
  options *plausibly wrong in misconceived ways* — that is what makes the misconception cards land.
- If a phase overruns, cut from the bottom of the ladder and log it. Do not let T5 cannibalise T4.
