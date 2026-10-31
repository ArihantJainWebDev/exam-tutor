Current status: diagnostic has eight questions; teacher cohort remains Phase 4. Historical percentages/timings below are illustrative. Seed resets learner evidence; fixtures must be disclosed.

# PS 02 demo — 3 minutes

One continuous screen recording, no cuts, narration dictated in Wispr over the good take. Seed with `npm run seed`
(concepts, bank, and the cohort at a fixed seed) so every take is identical. Rehearse three passes in `MOCK_LLM=1`,
then record the live pass.

The one thing the video has to show: **a wrong answer changes the model, and the model changes what it asks next.**
Everything else is supporting detail.

| Time | Screen | Narration beats |
|---|---|---|
| 0:00–0:15 | `/tutor`, question 1 of a session, exam-paper layout, marks in the margin | "Most AI tutors answer your question and forget you. This one keeps a model of what each concept is worth to you." |
| 0:15–0:35 | quick check: 5 questions answered fast, mastery strip in the margin populates | "Five questions in, it has a starting estimate for each concept — same update rule as the rest of the session, nothing separate under the hood." |
| 0:35–1:30 | the `m:current-consumed` item. Type (or paste) the reasoning verbatim from [PROMPTS.md §Scripted](PROMPTS.md). Submit → **red-pen card** quotes "the current is used up by the first bulb", states the correct principle, gives the remediation hint | Slow down. This is the money minute. "It didn't just mark the answer wrong — it read the reasoning and named the belief: current is consumed by a bulb. And it quotes the student's own sentence, so you can check whether it actually understood." |
| 1:30–1:50 | `elec:series-circuits` node in the margin/graph drops from ~62% to ~41%, red annotation appears | "That concept's estimate just moved, with a timestamp and the attempt it came from." Open `/tutor/debug` for two seconds — versions, `at`, `sourceId` — then close it. "This is the object the app reads from; it isn't painted onto the screen." |
| 1:50–2:20 | next question renders, provenance footer visible: *targeted `elec:series-circuits` · mastery 41% · difficulty 1* | "The next question is chosen because that node is now the weakest, at the difficulty band that mastery supports. It dropped to an easy item on purpose — that's the calibration." |
| 2:20–2:40 | careless-slip item answered with a right setup and a wrong division → "not sure what went wrong here — walk me through it again" | "And it doesn't invent misconceptions. That was a division slip, so it says so." Let this land — it is the strongest "real system" evidence in the whole video and costs ten seconds. |
| 2:40–2:55 | SRS line "revision due today: 3 cards", then `/tutor/teacher` heatmap | "Weak concepts come back tomorrow on a spaced schedule. This is the teacher view — twenty learners simulated against the same question bank, so these numbers are model output, not a mock file." |
| 2:55–3:00 | gap ranking, top row `elec:series-circuits` | "Class-wide, the same concept is the weakest. That's what a teacher needs on Monday morning." |

## Shot requirements

- The margin mastery value must be **on screen before and after** the misconception event, both readable. If the
  animation is too fast, add a 600 ms delay — legibility beats polish.
- The red-pen card's quote must be the student's verbatim words, visible in frame next to the original reasoning text.
- The provenance footer on the next question, on screen ≥3 seconds.
- The careless-slip beat included; do not cut it for feature count.
- The URL bar visible once (deployed, not localhost). No chat box in frame. Do not show `/meetings` — separate
  submission, separate narration account.

## Before recording (15-minute gate)

1. `npm run seed && npm run dev`, clean browser profile, 100% zoom, big cursor, notifications off.
2. The three scripted reasoning strings typed into a scratch file and copied in, so hand-timing on camera is not the
   variable that breaks the take. (Paste is fine; say "typed by the student" rather than claiming live typing.)
3. Live model pass once with real classification. If a call exceeds ~3 s, pre-warm before recording so the click feels
   immediate; never ship the video on a spinner.
4. Confirm `npm run validate:content` passes — one physics error on camera is the most expensive possible defect here.

## Submission bundle

Deployed URL (`/tutor`, plus `/tutor/teacher` linked in the README). GitHub repo with a README adapted from
[README.md](README.md) + [ARCHITECTURE.md](ARCHITECTURE.md) §3–§5 — the mastery formula and the closed-set classifier
should be readable in 90 seconds, because they are the answer to "is this a wrapper?". Include `.env.example`, the
`MOCK_LLM` disclosure, and `npm test` output showing the model properties pass. Video: `ps02-tutor-demo.mp4`.

## Cut order if you're out of time

Diagnostic as a separate mode (T6) → chapters beyond electricity + light → `/tutor/graph` as a standalone page (the
margin strip already carries it) → dashboard drill-down. Never cut the mastery update, the targeted next question, or
the misconception card — the floor condition in D-009 says a real loop beats a finished-looking fake.

## Phase 3 browser check (without modifying existing progress)

Continue to a new question in MOCK_LLM=1. Submit an incorrect option with reasoning. You should see feedback and a scheduled review; arbitrary reasoning gets a conservative no-finding fixture response. Open Scheduled concepts to inspect dates and review boxes. Refresh and verify feedback, source badge and schedule persist.

For a reproducible tagged example using a fresh diagnostic, stop server, run npm run seed (erases demo progress), restart in mock mode and start diagnostic. Answer the first question, then on question two (light-01), choose 30 degrees and paste this exactly:

The ray hits the mirror at 30 degrees from the surface, so the angle of incidence is 30 degrees.

Expected: fixture badge; exact quoted evidence; correction that incidence is measured from the normal; extra mastery penalty; a remediation review scheduled one day later. /tutor/debug should contain tutor.misconception and tutor.srs records. No need to wait a day to verify the computed timestamp; automated tests exercise due-time behavior with an injected clock.

The arithmetic-slip input for elec-03 in mocks/tutor.classify.cases.json must return no diagnosis while still reducing mastery and scheduling review. Do not claim that arbitrary fixture text proves a student's reasoning correct.
