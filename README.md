# Redpen — PS 02 adaptive exam-prep tutor · solo track

**Submission:** solo (B) · **This folder is its own repo and a standalone Next.js app** (D-012)
**Code:** `src/lib` (domain, pure functions) · `src/app` + `src/components` (UI) · `src/platform` (this repo's platform copy) · routes under `/tutor`
**Read first:** [../docs/DECISIONS.md](../docs/DECISIONS.md) D-005, D-006, D-009, D-012 · [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) §4, §8

## Run (from this folder)

```
npm install
cp .env.example .env.local     # MOCK_LLM=1 by default; add LLM_API_KEY for live classification
npm run dev                    # → http://localhost:3000/tutor
npm test                       # platform unit tests (10 passing at scaffold time)
npm run typecheck
npm run build
npm run seed                   # reset data/store.json for a clean demo take
```

Phase 1 content is implemented: 24 concepts, 40 original MCQs, 12 misconception definitions, a typed validator and
server loader. `/tutor/graph` now loads the authored graph; concepts retain "no evidence" until actual learner
attempts exist. The student answer loop, runtime prompts, mastery, SRS and teacher model remain for phases 2–4.
Run `npm run validate:content` to check the bank. See [content/physics/README.md](content/physics/README.md) for
syllabus scope and review notes, [PHASE-LOG.md](PHASE-LOG.md) for verification, and [CHANGELOG.md](CHANGELOG.md).

The active delivery plan has four phases; the old T0–T7 labels are detailed task references, not current clock times.

## Thesis, in one line

A tutor that keeps a per-concept mastery model, reads the *reasoning* in a wrong answer to name the misconception,
and changes what it asks next because of it — then shows the whole class's gaps to a teacher.

The brief's own framing is the trap to avoid: generic AI tutors answer questions. Ours must demonstrably *know
something the student did not tell it directly*, and prove it by what it asks next.

## Requirements coverage

| Requirement | Where | Ladder |
|---|---|---|
| Diagnostic test | `lib/diagnostic.ts`, `/tutor` start screen | 5 |
| Concept graph for one syllabus | `content/physics/graph.json` (5 chapters, ~24 concepts, prereq edges) | data |
| Learner model updating mastery per concept | `lib/mastery.ts` + `@/platform` ns `tutor.mastery` | 1 |
| Question generation targeted at weak concepts, difficulty calibrated | `lib/selection.ts` | 1 |
| Misconception detection from reasoning, not just the wrong answer | `lib/misconception.ts` + `tutor.classify` prompt | 2 |
| Spaced-repetition scheduling | `lib/srs.ts` (Leitner 1/3/7/21/60d) | 3 |
| Teacher dashboard, class-wide gaps | `lib/cohort.ts` + `/tutor/teacher` Heatmap | 4 |

## Scope ladder — cut from the bottom, silently

1. mastery model + targeted next question · 2. misconception from reasoning · 3. SRS queue · 4. teacher dashboard ·
5. standalone diagnostic mode · 6. chapters beyond the scripted 5.

**Floor condition (D-009):** this product may not degrade into a static quiz with a mocked dashboard. Items 1 and 2
are the submission. If they are not working by H5:15, stop all UI work, cut screens down to `/tutor` and
`/tutor/teacher`, and get the loop honest — an incomplete-but-real model beats a finished-but-fake one, because a
judge can poke the fake one in ten seconds and cannot poke the real one at all.

## Golden path (see [DEMO.md](DEMO.md))

Answer a Current Electricity question wrong, with written reasoning that says current gets used up → red-pen
misconception card names `current is consumed in the circuit` and quotes the student's own words → the mastery margin
for `elec:series-circuits` visibly drops → next question is tagged to that concept at difficulty 1 → SRS puts it due
in 1 day → teacher heatmap shows 20 learners with real model output.

## Solo-specific protections

- Content first, code second: `graph.json` + `bank.json` (~40 tagged items) are authored/generated in P1, before the
  platform phase ends. Question authoring at hour 5 is how this track loses item 2.
- Model functions are pure and tested in the terminal before any component exists. They can be demoed from the console
  if the UI slips.
- The H4 cross-help gate: if items 1–2 aren't passing at H4:00, A1 moves over and PS 03 drops to ladder 1–4.
- No external dependency can break this product. Keep it that way: no DB service, no third-party API, no auth.

## Definition of done for the track

Answering a question measurably changes store state (inspectable in `/tutor/debug`, which is fine to show — it's a
JSON view of the learner model with timestamps and provenance), the next question provably targets the dropped
concept, the misconception card quotes the student, the SRS queue moved, and the teacher heatmap numbers come from
`lib/cohort.ts` running the real model — not literals. Kill checks 5–8 ticked.

## Try Phase 2

Set MOCK_LLM=1, run npm run dev and open /tutor. Start the eight-question diagnostic or direct practice, choose an answer, explain why, submit and continue. Refresh to resume. /tutor/graph and /tutor/debug show saved evidence.

This phase requires no model connection. Questions are selected from the authored bank; novel question generation is not implemented. There is one shared demo learner. To reset, stop the server, run npm run seed and restart it. Browser interaction acceptance is pending; service-level and build checks pass.
