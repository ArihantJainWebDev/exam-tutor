# PS 02 architecture

The platform layer lives **in this repo** at `src/platform/` (an independent copy, D-012); its design is specified in
[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) §4–§5. The learner model is
`MemoryStore` namespace `tutor.mastery`, keyed by `conceptId`, `at` = answer time. Nothing here re-decides that.

## 1. Content data

```ts
// content/physics/graph.json
type Concept = {
  id: string;                 // 'elec:series-circuits'
  label: string;              // 'Series and parallel circuits'
  chapter: string;            // 'elec' | 'light' | 'eye' | 'magnet' | 'energy'
  prereqs: string[];          // concept ids — readiness factor in selection
  difficultyCeiling?: 1|2|3;
};

// content/physics/bank.json
type Item = {
  id: string;
  conceptIds: string[];       // 1–2, never more: ambiguous attribution breaks the model
  difficulty: 1|2|3;
  kind: 'mcq' | 'short';
  stem: string;
  options?: string[];
  answer: string | number;
  reasoningPrompt: string;    // 'Why did you choose that?' — mcq items must ask this
  misconceptionTags: string[];// tags this item is *diagnostic for*
  explanation: string;
  markAllocation: 1|2|3|5;    // rendered as exam-paper margin marks
};
```

Five chapters, NCERT Class 10 Science: Electricity · Light: Reflection and Refraction · Human Eye and the Colourful
World · Magnetic Effects of Electric Current · Sources of Energy. Chapter numbering differs between textbook
editions; the `chapter` slugs above are stable and are the only thing code depends on. ~24 concepts, ~40 items,
all concepts covered and all difficulty bands represented per chapter, expandable with the generation prompt.
Phase 1 provides 40 total items, not 2–3 for every concept at every band (D-014).
Sources of Energy is explicitly legacy/extension practice, not current rationalised textbook coverage.

## 2. Misconception taxonomy (closed set — this is load-bearing)

`content/physics/misconceptions.json`, one entry per tag: `{ id, label, conceptIds[], correctPrinciple, remediationHint }`.
An item may have no diagnostic tag when none of this closed set applies. Tags describe possible evidence to look for,
not an automatic diagnosis for any incorrect option. Phase 1 loader validates schema, references and prerequisite DAG.

| id | the belief |
|---|---|
| `m:current-consumed` | current is used up as it passes through a bulb |
| `m:series-voltage-same` | each component in series has the same voltage as the source |
| `m:resistance-length-only` | longer wire always means more current, ignoring cross-section |
| `m:angle-from-surface` | angle of incidence measured from the mirror surface, not the normal |
| `m:plane-image-real` | the image in a plane mirror is real and projectable |
| `m:denser-bends-away` | light bends away from the normal entering a denser medium |
| `m:ignores-sign-convention` | mirror/lens formula applied without sign convention |
| `m:power-is-energy` | a watt rating treated as the energy consumed |
| `m:short-vs-overload` | short circuit confused with overload |
| `m:myopia-convex` | myopia corrected by a convex lens |
| `m:scattering-agnostic` | blue sky explained without wavelength dependence |
| `m:solar-stores-power` | a solar cell described as storing energy |

Why closed-set: classification into 12 known tags with definitions in the prompt is accurate, cheap, and auditable on
camera. Open-ended "what misconception does this show?" produces confident, wrong, ungradeable prose — and a judge who
knows physics will spot one bad card and discount the whole feature. `conceptIds` per tag is what lets a misconception
penalise the right node.

## 3. Learner model — `lib/mastery.ts`

One-parameter IRT (Rasch) in logit space with an EWMA update. Small, defensible, testable.

```ts
export const THETA_MIN = -3, THETA_MAX = 3, ALPHA = 0.35, K = 1;  // K fixed = Rasch

export const pCorrect = (theta: number, difficulty: number) =>
  1 / (1 + Math.exp(-(theta - (difficulty - 2))));   // difficulty 2 ⇒ logit 0 ⇒ theta = 0 gives p = 0.5

export function updateMastery(prev: State, ev: Evidence): State {
  const p = pCorrect(prev.logit, ev.difficulty);
  const observed = ev.correct ? 1 : 0;
  let logit = clamp(prev.logit + ALPHA * (observed - p), THETA_MIN, THETA_MAX);
  const tag = ev.misconception?.confidence >= 0.55 ? ev.misconception.tag : null;
  if (tag) logit = clamp(logit - 0.20 * (ev.misconception!.confidence), THETA_MIN, THETA_MAX);
  const attempts = prev.attempts + 1;
  const correctStreak = ev.correct ? prev.correctStreak + 1 : 0;
  return {
    logit,
    mastery: 1 / (1 + Math.exp(-logit)),                       // 0..1, rendered as %
    confidence: Math.min(1, attempts / 5),                      // UI greys out low-evidence nodes
    lastAt: ev.at, attempts, correctStreak,
    misconceptionStrength: {                                     // counted only for real tags
      ...prev.misconceptionStrength,
      ...(tag ? { [tag]: (prev.misconceptionStrength[tag] ?? 0) + 1 } : {}),
    },
  };
}
```

Properties worth asserting in tests, because they are what make the model believable:
correct on an easy item ⇒ small gain · correct on a hard item ⇒ large gain · wrong on an easy item ⇒ large drop ·
wrong on a hard item ⇒ small drop · repeated correct answers converge · bounds hold · mastery % is monotone in logit.

Multi-concept items distribute the update: `ALPHA / item.conceptIds.length` each. The store keeps every version, so
`/tutor/debug` can replay "how did this number get here" — provenance again, and it is cheap because §4 of the shared
architecture already stores versions.

## 4. Question selection — `lib/selection.ts`

```ts
export function nextQuestion(state: Record<ConceptId, State>, bank: Item[], opts: {now: string, recentIds: string[]}) {
  return bank
    .filter(i => !opts.recentIds.includes(i.id))
    .map(i => {
      const weakest = Math.min(...i.conceptIds.map(c => state[c]?.mastery ?? 0.3));
      const band = weakest < 0.35 ? 1 : weakest <= 0.65 ? 2 : 3;
      const difficultyFit = 1 - Math.abs(i.difficulty - band) / 2;          // calibrated to mastery
      const readiness = i.conceptIds.every(c => prereqsSatisfied(state, c)) ? 1 : 0; // don't teach above a broken prereq
      const srsDue = dueScore(state, i, opts.now);                          // 0.3 if any concept is past its interval
      const tagBonus = i.misconceptionTags.some(t => fired(t, state)) ? 0.25 : 0;
      return { i, score: 1.6 * (1 - weakest) + 1.0 * difficultyFit + 0.8 * readiness
                                          + srsDue * 0.6 + tagBonus };
    })
    .sort((a, b) => b.score - a.score)[0]?.i;
}
```

Pure, deterministic, unit-tested on the exact assertion the demo claims: lower `elec:series-circuits` mastery to 0.3
⇒ a question tagged to it ranks first. If that test fails, the demo's central claim is false, and the test is the only
reason anyone will notice before the video.

## 5. Misconception detection — `lib/misconception.ts`

`classifyReasoning({item, studentText})` → `platform.llm('tutor.classify')` with the taxonomy definitions inlined and
`conceptIds` restricted to the item's own. Returns `{tag | 'none', confidence, quote, remediationHint}`.
Only `confidence ≥ 0.55` renders the red-pen card; below that the UI says "not sure — walk me through it again",
which is honest and, in demo terms, looks like a tutor rather than a bug. The card always displays `quote` — the
student's own words — because that is what proves it read reasoning and not the answer key.

Wrong-but-no-misconception is a real case (careless error) and must be handled: mastery still drops, no tag fires, and
the SRS interval is set shorter. Never force a tag.

## 6. Spaced repetition — `lib/srs.ts`

Leitner boxes, intervals `[1, 3, 7, 21, 60]` days. Correct with `mastery > 0.6` ⇒ box+1; correct but low confidence ⇒
hold; wrong ⇒ `max(0, box-2)`; a fired misconception ⇒ box 0 with a `remediation` flag so it returns as an easier item.
`due(now)` returns the queue, rendered as "revision due today" under the current question — not a separate page, so it
stays in the demo path for free.

## 7. Diagnostic — `lib/diagnostic.ts` (ladder 5, may be trimmed)

8 items: one per chapter's root concept, then 3 at mixed difficulty spanning `elec` and `light` (the two chapters the
demo uses). Runs the same `updateMastery` with `ALPHA * 1.4` for a faster initial fit. No separate code path for the
model — that is the point: the diagnostic is just the first 8 evidence events. If time is short, present the first 5
questions of a session as "a quick check of where you are" and delete the mode; nothing downstream changes.

## 8. Teacher dashboard — `lib/cohort.ts` (ladder 4)

`simulateClass(n = 20, seed)` builds synthetic learners with a hidden true logit per concept drawn from three
archetypes (strong / mid / shaky) plus noise, replays ~40 answers each through the **real** `updateMastery` and the real
item bank, and writes the results under a cohort namespace. The dashboard then reads model output, not literals.

Heatmap rows = concepts, columns = learners, cell = mastery % tinted by the tutor tokens. Plus: class gap ranking
(concepts by ascending mean, lowest first), misconception frequency bars (top 5 tags across the cohort), at-risk list
(`mastery < 0.35 && confidence > 0.6`), and a per-student drill-down reusing `FactList`.

Narration-safe framing: "twenty students simulated against the same bank — these numbers come from the model, not from
a mock file." If asked, the code proves it; the seed function is 40 lines and readable.

## 9. Screens

| Route | Screen | Ladder |
|---|---|---|
| `/tutor` | exam-paper document: current question, mark allocation in the margin, reasoning box, red-pen feedback, mastery strip in the right margin | 1–3 |
| `/tutor/graph` | concept map with nodes coloured by mastery, low-evidence nodes hatched, prereq edges visible | 1 |
| `/tutor/teacher` | heatmap + gap ranking + misconception bars + at-risk list | 4 |
| `/tutor/debug` | raw learner model: versions, timestamps, provenance — shown briefly, it is the "not magic" evidence | — |

Design: [../docs/ARCHITECTURE.md §8](../docs/ARCHITECTURE.md) — grid/ruled paper ground, ballpoint blue `#1D3E8C` for
student text, red pen `#C0392B` for corrections, question-paper numbering, `Caveat` only for annotations.
Layout language is a centred document, which is what keeps it visually unrelated to PS 03's dense left-gutter list.

## 10. Files owned by this track

the other repo, `ps-02-exam-tutor/`, `content/physics/**`, `prompts/tutor.*.md`, `mocks/tutor.*.json`,
`src/styles/tokens.css`, `src/app/**`. Platform changes inside this repo are allowed but must be logged in
`../docs/STATE.md`. Never touch the other repo, `ps-03-meeting-execution/`.
