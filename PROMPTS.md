# PS 02 prompts

**RUNTIME** ships in `prompts/` and needs a mock in `mocks/`. **BUILD** goes to your coding
agent; dictate it (D-010). A 10-hour build spends more time prompting an agent than prompting a model — both are here.

---

## RUNTIME 1 · `tutor.classify` (misconception detection from reasoning)

System:
> You are a physics teacher reading one student's written reasoning for a wrong answer. Choose at most one known
> misconception from the provided list, or `none`. You are not judging the final answer; you are judging the reasoning.
> A careless arithmetic slip, a misread number, or an unfinished explanation is `none` — do not force a match.
> Reply with JSON only.

User template:
```
Question: {{item.stem}}
Correct answer: {{item.answer}}
Student's answer: {{student.answer}}
Student's reasoning, verbatim: """{{student.reasoning}}"""

Candidate misconceptions (the only ones permitted):
{{#each candidates}}
- {{id}}: {{label}} — the student believes: {{belief}}. Correct principle: {{correctPrinciple}}
{{/each}}

Return {
  "tag": "<one of the candidate ids | 'none'>",
  "confidence": 0.0-1.0,
  "quote": "<the exact substring of the reasoning that shows it, verbatim, ≤25 words, or null>",
  "correctPrinciple": "<one sentence, from the candidate entry, or null>",
  "remediationHint": "<one sentence, next-step advice, not a lecture>"
}
Rules: never invent a tag; `quote` must appear verbatim in the reasoning — if you cannot produce one, return `none`
with confidence ≤ 0.3.
```
Candidates are filtered in code by `conceptIds ∩ item.conceptIds ≠ ∅`, so the model sees ≤5 options.
`confidence < 0.55` ⇒ no card. The verbatim-quote rule is what stops the "you seem to confuse X with Y" hallucination
that makes a feature like this look fake.

## RUNTIME 2 · `tutor.explain` (optional, ladder 6)

Only if time survives: a one-paragraph red-pen explanation of the correct principle for the fired tag, constrained to
the concept's own syllabus scope ("Class 10 NCERT level, no calculus, ≤45 words, no emoji").

---

## BUILD 1 · content generation (T0 — use this at H0:30, dictated)

> OBJECTIVE: produce `content/physics/bank.json` — 24 additional Class 10 Physics items for chapters
> electricity + light, tagged per the schema below.
> CONTEXT: read ps-02-exam-tutor/ARCHITECTURE.md §1–§2 first. The misconception taxonomy in
> `content/physics/misconceptions.json` is fixed; tag items to those ids only. Schema:
> `{id, conceptIds[1-2], difficulty 1-3, kind mcq|short, stem, options?, answer, reasoningPrompt,
> misconceptionTags[], explanation, markAllocation}`.
> CONSTRAINTS: write to `content/physics/bank.gen.json` only — never edit `bank.json`, I will merge by hand.
> `reasoningPrompt` must ask *why*, not "show your working". Every wrong option must be wrong for a reason a real
> student would give, ideally matching a listed misconception — no joke distractors, no "none of the above".
> Difficulty 1 = single formula substitution · 2 = two-step or graph/circuit interpretation ·
> 3 = multi-concept or an assertion-reason pair.
> DONE WHEN: `npm run validate:content` passes against the generated file and every item is physics-correct.
> REPORT: 3 lines — count, concepts covered, tags used.

Second pass, dictated separately: *"Now write the assertion–reason and numerical items for
`magnet:*` at difficulty 2, same schema, same file."* Splitting generation into ~8-item batches is how you keep the
model correct; asking for 40 items in one prompt is how you get 12 subtly wrong ones.

## BUILD 2 · `lib/mastery.ts` (T1)

> Implement `pCorrect`, `updateMastery`, `clamp` exactly as written in ps-02-exam-tutor/ARCHITECTURE.md §3 — the
> constants and the multi-concept split are already decided, do not substitute a different model. Add the six property
> tests named in §3 using `node:test`, in `src/lib/mastery.spec.ts`. Pure functions, no imports from
> React or `@/platform`; the caller persists. Do not create any component. Do not touch the other repo, `ps-03-meeting-execution/`.
> DONE WHEN: `npm test` passes and a 10-answer simulated trajectory from logit 0 converges rather than oscillating.

## BUILD 3 · `lib/selection.ts` (T2)

> Implement `nextQuestion` per ARCHITECTURE §4 with the exact weights there. Write the two tests the demo depends on:
> (a) mastery 0.3 on `elec:series-circuits`, all other concepts ≥0.7 ⇒ top-ranked item's `conceptIds` includes it;
> (b) mastery 0.8 on a concept ⇒ a difficulty-3 item outranks difficulty-1 for the same concept. Fixtures inline, no
> network. Then wire `/tutor`: submit answer → `updateMastery` → `@/platform` put → next question → margin strip.
> Every rendered question carries a provenance footer naming the targeted concept, its mastery %, and the difficulty.
> UI must use the exam-paper tokens in `src/styles/tokens.css` — question-paper numbering, mark allocation in
> the margin, ballpoint blue for student text, red pen for feedback. No chat input, no card stack, no gradients.

## BUILD 4 · `lib/misconception.ts` (T4)

> Implement `classifyReasoning` calling `callLlm` from `@/platform` with prompt `tutor.classify` (paste the prompt text from
> PROMPTS.md into `prompts/tutor.classify.md`). Filter candidates in code by concept intersection.
> Render `RedPenCard` only at `confidence ≥ 0.55`, always showing `quote` in red pen under the student's own text,
> then `correctPrinciple` and `remediationHint`. Below threshold: "I'm not sure what went wrong here — walk me
> through it again", and still penalise mastery, with no tag. Register mocks for the three scripted demo reasonings
> listed in PROMPTS.md §Scripted, so `MOCK_LLM=1` reproduces them exactly. Tests: the consumed-current reasoning
> classifies to `m:current-consumed`; a correct reasoning returns `none`; an arithmetic-slip reasoning returns `none`
> while mastery still drops.

## BUILD 5 · `lib/cohort.ts` (T5)

> Implement `simulateClass(n=20, seed)` per ARCHITECTURE §8. Three archetypes plus noise drawn with a seeded PRNG so
> output is reproducible. Replay ~40 answers per learner through the real `updateMastery` — import it, do not
> reimplement or shortcut it — and write results to the store under namespace `tutor.cohort.<id>`. Render
> `/tutor/teacher`: `Heatmap` from `@/platform/ui` (concepts × learners), gap ranking by ascending mean mastery, top-5
> misconception frequency bars, at-risk list (`mastery < 0.35 && confidence > 0.6`), student drill-down via `FactList`.
> Hardcoding any displayed number is a defect. Test determinism for a fixed seed, and that a low-true-ability learner
> ends below 0.5 mastery on ≥60% of their concepts.

---

## Scripted reasoning strings (make these the fixtures for mocks and the demo)

1. **Will fire `m:current-consumed`** — series circuit, bulb brightness question:
   > "The current is used up by the first bulb so the second one gets less current and glows dimmer."
2. **Will fire `m:angle-from-surface`** — plane mirror reflection:
   > "The ray hits the mirror at 30 degrees from the surface, so the angle of incidence is 30 degrees."
3. **Careless slip, must NOT fire any tag** — numerical Ohm's law:
   > "V is 2 V and R is 0.5 Ω, so I = V ÷ R = 2 ÷ 0.5 = 1 A." *(setup and formula are right; the division is
   > wrong — the answer is 4 A — so this is a slip, not a belief)*
4. **Will fire `m:denser-bends-away`** — refraction:
   > "When light goes from air into glass it speeds up so it bends away from the normal."

Item 3 is the credibility test. A system that always finds a misconception is a generator; one that says "that's just a
slip, let's see it again" is a tutor. Rehearse the demo so item 3 appears on camera — it costs ten seconds and it is
the strongest single piece of "this is a real system" evidence available in the video.

## What to reject if an agent produces it

Open-ended misconception text. A mastery number that is a React `useState` counter. A dashboard with literal values.
A "recommended next question" that ignores which concept just dropped. A chat interface. Generic card UI in the tutor's
own colours, or anything that makes `/tutor` look like a sibling of `/meetings`.

## Phase 3 implementation notes

The canonical runtime system prompt is prompts/tutor.classify.md. Classifier IO lives in src/app/tutor/classifier.ts; src/lib/misconception.ts contains only pure validation and candidate filtering. All calls use callLlm.

mocks/tutor.classify.json is a conservative none response. mocks/tutor.classify.cases.json maps an exact item id plus trimmed scripted reasoning to a named fixture variant for consumed current, surface-angle confusion, refraction or the arithmetic slip. These variants share the same system prompt. Mock mode recognises only these exact scripted inputs; arbitrary reasoning gets no diagnosis. This is fixture replay, not offline AI. The fixture source and live-failure fallback are visible in feedback and retained with the attempt.

Correct answers or questions with no relevant taxonomy candidates skip the model. Wrong answers use only intersecting concept tags. Confidence >= 0.55 is required to fire. Quote must be an exact substring with at most 25 words; principle must match the taxonomy. Both live and mock results are checked. An unavailable classifier does not stop grading or schedule updates.

Live provider connectivity remains unverified; request/parse/retry/fallback paths are exercised with controlled responses. Do not describe fixture replays as live reasoning analysis.
