# Redpen phase log

## Phase 1 — content foundation — 2026-10-31

Status: implemented. Next: Phase 2 (not started).

Deliverables: 24 concepts across the agreed five chapters, 40 original questions, 12 misconception definitions, content types, validation, server loader, build-time authoring prompt and documented review.

Acceptance: schema and reference validation; acyclic prerequisites; every concept covered; all three difficulty bands in each chapter; at least eight demo questions across electricity/light; typecheck and tests; content loads without a network/model key; mock-mode shell remains usable.

Remaining phases: 2 adaptive tutor/diagnostic; 3 misconception/SRS; 4 teacher/dashboard/submission.

### Delivered

- 24-node acyclic concept graph; 40 MCQs with exact answer keys, explanations, reasoning prompts and difficulty; 12 closed-set misconception definitions.
- Pure TypeScript contracts and validation, platform-backed server loader, validation command and six content regression tests.
- Concept route uses the validated loader. Seed validates before resetting and creates no fictional mastery.
- Build-only authoring prompt, syllabus/source notes, agent editorial review record, active plan and changelog.

### Verification

- `npm run validate:content`: passed (24/40/12); every concept and tag covered, three bands per chapter.
- `npm run typecheck`: passed.
- `npm test`: 16/16 passed (10 platform + 6 content tests). No live model needed.
- `npm run build`: passed (production compilation, types and page generation).
- `MOCK_LLM=1 npm run dev -- --hostname 127.0.0.1 --port 3022`: started successfully.
- Local HTTP smoke: not verified; socket EACCES in the restricted process, timeout in the elevated retry. Do not interpret server startup as visual verification.
- Independent human physics approval and actual student learning outcomes have not been verified.

No learner-model or runtime-classifier functionality is claimed by Phase 1.

### User browser evidence — 2026-10-31

Four supplied screenshots confirm the session preview (24 concepts/40 items, zero learner evidence), populated concept rows with prerequisites and "no evidence", teacher empty state, and learner-model empty state all render in mock mode. No error overlay is visible. The concept screenshot is partial; remaining chapter rows, refresh persistence, mobile layout, terminal and console errors are not established by these images.

Screenshot review found the session preview hardcoded a three-mark label for the one-mark first question. Corrected it to read `markAllocation` from the validated content loader. The updated mark needs a browser refresh check; the supplied screenshot shows the earlier value. This follow-up does not implement Phase 2.


## Phase 2 � diagnostic and adaptive tutor � 2026-10-31

Status: implemented; browser interaction verification pending. Phase 3 not started.

### Delivered

- Rasch/logit mastery: alpha 0.35, bounded logits, evidence confidence/streaks, multi-concept rate split, diagnostic multiplier 1.4.
- Eight diagnostic questions spanning five chapters then mixed electricity/light; automatic transition to adaptive practice, or direct practice entry.
- Deterministic scoring with documented weights, difficulty bands, prerequisite readiness bonus, question provenance and finite-bank fallback. Last five answered items normally excluded; exhaustion relaxes older exclusions but keeps immediate exclusion.
- Server-side grading, required reasoning, saved attempts, versioned mastery and current session. Answer key omitted from initial question payload, revealed after submission.
- Duplicate/stale guards, per-process mutation queue, pending controls and resumed option/reasoning/feedback after refresh.
- Accessible radio/textarea form, concept evidence, responsive notebook CSS. Graph/debug read the same saved evidence.

### Behavior and limits

- Single shared demo learner without accounts or isolation. Reset: stop server, npm run seed, restart (clears cached in-process store).
- Unknown concepts display no evidence; their ranking prior is 0.3. First evidence updates from neutral logit zero / 50%. Unseen concepts may outrank a just-answered concept. Controlled known mastery states verify the weak-concept example.
- Prerequisites contribute the planned soft 0.8 bonus at a 0.5 mastery threshold, not a hard gate.
- Bank selection is implemented; generation of novel questions is not. This remains a gap against the brief's literal question-generation wording, not a completed claim.
- Reasoning is stored; classifier/SRS hooks remain inactive until Phase 3. No NVIDIA live-call claim.
- Local FileStore persists asynchronously. Per-process serialisation handles ordinary duplicate/concurrent submissions; it does not provide cross-process locks, transactions or crash recovery across multi-record writes. Serverless durable storage is not implemented.

### Verification

- Content validation passes: 24 concepts / 40 items / 12 tags.
- Typecheck and production build pass.
- 27/27 tests pass. Learning tests cover bounds/convergence, difficulty, split evidence, diagnostic multiplier, targeting, exhaustion, diagnostic coverage/transition, malformed/stale/duplicate requests, answer-key omission, feedback resume, and file-backed restart.
- Persistence test initially encountered EPERM in redirected system temp; isolated fixture moved under app data, where persistence and cleanup pass. Platform code was unchanged.
- Browser interaction and mobile rendering not yet verified. These tests establish service behavior, not browser acceptance.

### Browser acceptance

1. Run MOCK_LLM=1 and open /tutor. Start diagnostic or direct practice.
2. Choose an option, write reasoning and submit. Check explanation, saved answer count and mastery changes.
3. Refresh on feedback: selected option, reasoning and count should remain. Click Next question.
4. Finish eight diagnostic questions; check transition into practice.
5. Open /tutor/graph and /tutor/debug; observed concepts have mastery, version and provenance; unobserved concepts remain no evidence.
6. Restart server and check resume. Check narrow viewport and console errors.

## Phase 3 - reasoning analysis and spaced review - 2026-10-31

Status: implemented; browser acceptance pending. Next: Phase 4 (not started).

Phase 2 follow-up: user confirmed eight diagnostic questions switched into continued practice. This verifies the basic browser transition, not all refresh/mobile/selection scenarios.

### Delivered

- Pure candidate filtering and classification validation; server adapter calls the named tutor.classify prompt through callLlm.
- Only wrong answers with relevant taxonomy candidates invoke the model. Exact quoted substring (max 25 words), allowed tag, bounded confidence and exact taxonomy principle required. Correct answers and questions without relevant tags skip classification.
- RedPenCard quotes reasoning, explains the vetted principle/hint and shows response source. Confidence below 0.55 makes no diagnosis or additional penalty. Arithmetic slips can remain none.
- Persisted tutor.misconception evidence plus source metadata on attempts/feedback; penalties affect only concepts intersecting the diagnosed taxonomy tag.
- Pure Leitner scheduling stored in tutor.srs by concept with attempt provenance. Intervals 1/3/7/21/60 days: correct and mastery >0.6 promotes; other correct holds; wrong drops two boxes; misconception resets to box zero/remediation. Correct clears remediation.
- Current/upcoming reviews shown in Session, dates in IST. Due concepts receive the existing scoring bonus; flagged targets prefer band one. Recent-item exclusions still apply.
- Redpen-only platform change: optional named fixture variant for mocks/cache; live system prompt stays shared. No other app edited.

### Fixture and compatibility behavior

- mocks/tutor.classify.cases.json registers four exact item/reasoning pairs and their fixtures. Default fixture returns none for unknown inputs. This is deterministic replay, not general offline analysis.
- Invalid live output retries once then uses the contextual fixture when available. Fixtures are revalidated against current reasoning/candidates. Mock/fallback badges appear even on no-finding responses.
- Total classifier failure still saves grading, normal mastery change and revision schedule without a diagnosis.
- Existing sessions continue. Previous answers are not retroactively classified/scheduled. Submit a new answer for Phase 3 behavior; old feedback may lack optional analysis/review fields.
- Per-process/file-store limitations from Phase 2 remain. No notifications are sent. Teacher analytics and novel question generation remain unimplemented.

### Verification

- Content validation passes (24 concepts, 40 items, 12 tags); typecheck passes.
- 38/38 tests pass: scripted cases and arithmetic slip, unknown/correct reasoning, forged quotes/tags/principles, confidence threshold, controlled live parsing, validated fixture fallback, SRS transitions and time boundaries, due/remediation ranking, persisted sources/schedules, duplicate handling, unavailable analysis, and multi-concept attribution. Existing disk-restart test verifies SRS and source fields.
- Production build passes after elevated retry. First attempt hit Windows EPERM creating a generated .next/types folder; retry compiled/generated pages successfully.
- Controlled responses verify gateway integration, not real NVIDIA connectivity. No real provider call was made.
- Browser interaction/mobile verification pending. See DEMO.md's Phase 3 browser check; reflection is diagnostic question two after an optional user-run reset.

### Browser expectations

In a fresh mock diagnostic, answer light-01 incorrectly with the exact surface-angle reasoning from the fixture registry. Expect a fixture-labelled quote/correction, concept-specific penalty and a next-day remediation review. Arbitrary text must not invent a diagnosis. Refresh must retain feedback/source/schedule. /tutor/debug should show tutor.srs and, only for supported diagnoses, tutor.misconception.


### User browser evidence - Phase 3

User screenshots confirm the mock-mode reflection diagnosis: exact reasoning quote, normal-based correction, fixture disclosure, mastery moving from 50% to about 37%, and next-day remediation review. Two scheduled concepts render. The Model page shows both saved attempts, correct-answer classification skipped, reflection misconception strength and source-linked mastery records. This verifies the scripted browser path; screenshots do not establish refresh/restart persistence, arbitrary live reasoning, mobile behavior or console cleanliness. Model page length is expected because it exposes raw records; no redesign requested.


## Phase 4 - teacher dashboard and release preparation - 2026-10-31

Status: feature implementation and local production checks complete. Hosted setup, final browser/live checks, recording and filing remain pending within this final phase. No additional feature phase is planned.

### Delivered

- Pure deterministic simulation of 20 learners/800 question events through existing mastery updates, with three ability archetypes and repeat evidence on selected concepts.
- Model-derived heatmap, ranked mean gaps with evidence counts, top simulated misconception frequencies, confidence-qualified risk list, learner selector and source/event drill-down.
- Persistent teacher snapshots isolated from the active practice learner. Initialisation is idempotent and concurrent-safe within a process; Redis commits the initial cohort atomically across instances.
- User chose Vercel and explicitly approved a Redis service despite the original no-database rule (D-018). Added dependency-free Upstash REST adapter with revision CAS, atomic multi-record actions, retry/reload and no unsafe Vercel file fallback. Local file mode and explicit file path remain supported.
- Removed unused generic model API, added deployment file tracing, seed CLI cohort setup, isolated production smoke, optional container files, DEPLOYMENT.md and SUBMISSION.md, and replaced the obsolete demo script with current behavior.
- User reports NVIDIA API connectivity working. This is recorded as user evidence, not an agent-observed live classifier response.

### Verification

- npm run validate:content: passed (24 concepts/40 items/12 tags).
- npm run typecheck: passed.
- npm test: 52/52 passed. New tests cover deterministic simulation/independent model replay, weak-group tracking, summaries and evidence-qualified risk flags, isolated/idempotent cohort seeding, Redis version/as-of/reset contract, CAS races, rollback, duplicate submission across instances, Redis failure guards and actual isolated seed CLI execution.
- npm run build: passed with elevated generated-file access on this Windows host. Source deployment files are prepared; optional Docker build was not executed.
- npm run smoke: passed against a production Node server with an isolated file store. /tutor, /tutor/graph, /tutor/teacher, teacher selection for learner-03 and /tutor/debug all return 200 with expected content; retired /api/llm returns 404. Smoke process exited and removed its own temporary data. Existing user store was not reset.
- Redis command/transaction behavior is verified with a controlled REST transport, not a real newly provisioned Upstash database. Hosted credentials are not yet available. CAS uses supported Redis Lua via the documented REST API.
- Earlier Phase 3 user screenshots establish the fixture browser diagnosis/review path. Teacher visual/mobile interaction and actual in-app live-source classification still need user confirmation.

### Remaining release checklist

- [ ] User creates/imports Vercel project and connects a write-capable Upstash Redis REST integration.
- [ ] Configure production/preview Redis keys and model environment, deploy intended commit, verify hosted progress across refresh and redeploy.
- [ ] Inspect teacher heatmap/selector/risk links and narrow layout in a browser.
- [ ] Verify a new answer produces Live model analysis, not merely fixture fallback.
- [ ] Record the three-minute demo, retain original screenshots/Wispr evidence and complete official submission fields.

Question generation remains authored-bank selection, not novel generation. The class is simulated, the practice learner is shared, and the syllabus scope includes legacy extension material. These limits are retained in README/SUBMISSION rather than presented as full production classroom support.

Release build tracing follow-up: Windows-generated manifests retained a local store path despite framework glob exclusions. Added a cross-platform post-build manifest guard, verified required runtime JSON/prompt/fixtures, and removed four local data references. Build guard does not alter source data or screenshots. This protects packaged artifacts as well as relying on .gitignore.


## Approved real-solution revision R1-R4

The active plan is ../docs/REDPEN-REAL-SOLUTION-PLAN.md (D-019). Earlier four-phase demo delivery below is historical. R1 personal sessions/live infrastructure is current; R2 teaching decisions, R3 validated generation and R4 real cohort/release follow.


## Real solution revision R1-R4 (D-019)

Feature implementation complete; Vercel/Redis provisioning and final browser acceptance remain external release checks.

- R1: signed HTTP-only guest identities, per-learner namespaces/local transactions and separate Redis learner snapshots; private Graph/Model views; own reset; teacher access code, expiring teacher cookie and cohort filtering. Local private session/teacher secrets configured without displaying them. Legacy shared data preserved but not assigned to new guests.
- R2: live reasoning analysis for correct and incorrect answers; slips, uncertainty and misconceptions lead to different teaching actions. Two distinct coherent verification answers are needed for improvement observed. Correct choices with contradictory reasoning are not rewarded as demonstrated understanding.
- R3: NVIDIA proposes parameter plans in seven vetted physics families across six concept areas. Local solvers own keys and render safe questions; duplicate plans/invalid parameters are rejected. Advanced/unsupported formats remain explicitly reviewed-bank items. API failure remains visible and never substitutes product fixtures.
- R4: teacher view reads enrolled learners' actual attempts and evidence. Synthetic cohort initialisation removed from the product path and seed CLI. Historical simulation code remains only for regression coverage.

Verification: 63 tests pass; typecheck/content validation pass. Signed-cookie HTTP checks passed for two isolated learners, unauthorised teacher gate and cross-cohort exclusion. Genuine NVIDIA classification and generated questions were observed. The full live wrong-reasoning -> generated check -> second generated check -> improvement loop passed with two 0.95 reasoning-confidence responses, without modifying user data or using fixture outputs. Initial provider timeouts/repeated generation were rejected; validators and explicit error states preserved progress.

Production verification uses .next-production-check to avoid interfering with the running development server. Current final build/smoke results follow below. No public deployment or hosted Redis verification is claimed.

Final result: isolated production build passed, runtime-file guard passed, and production HTTP privacy/teacher authorization smoke passed. All 63 tests plus typecheck/content validation pass. Full live NVIDIA correction and two-question verification flow passed. Latest browser click/layout acceptance and external Vercel/Redis setup remain pending.


## D-020 - Groq provider migration

Replaced NVIDIA defaults, environment example, current setup documentation and UI labels with Groq openai/gpt-oss-20b. Groq GPT-OSS uses max_completion_tokens and low reasoning effort; keys remain server-side and local secrets were preserved. Full live diagnosis -> two distinct generated follow-ups -> improvement-observed passed in approximately five seconds. Product remains live-only.

D-020 verification: 64/64 tests pass; typecheck and isolated production build pass; production privacy/teacher smoke passes. Real Groq learning loop passed without fixtures.


## D-021 - Strict generated-question format

Investigated the reported reflection answer: 50 degrees to surface correctly yields 40 degrees incidence. Reproduced live generation rejection on synthetic inputs: variant beta then uppercase A violated the renderer contract. Groq GPT-OSS generation now uses a strict JSON schema with lowercase variant enums, closed parameter objects and unused reflection angles; independent solvers and duplicate validation remain mandatory. Validation retries include the rejected assistant response. Notices distinguish invalid output, throttling and provider/transport failure. Five consecutive synthetic live generations and the complete isolated live transfer loop pass. No private learner history transmitted and no learner state reset.

D-021 verification: 66 tests and typecheck pass; isolated production build passes. Five fresh strict-schema live generations pass. First full-loop run encountered a provider interruption during the second reasoning review; repeat complete live loop passed. External provider errors remain possible and never receive fabricated evidence.


## D-022 - Meaningful adaptive task diversity

Added four independently graded thinking tasks across the seven supported generation families: identify a principle, explain an error, apply a principle to a changed situation, and calculate. Teaching actions and recent task history choose the next kind; generated verification requires two different kinds of task, not numerical variants. Correct improvement moves practice to another concept while retaining spaced reviews. Task labels and reasoning prompts explain the change. Saved sessions remain compatible; legacy untyped checks do not fabricate diverse evidence. Live Groq check passed error-explanation followed by application with sound reasoning at 0.95 confidence for both. Reviewed-bank fallback remains explicit outside supported generation.

D-022 verification: 71/71 tests pass, typecheck passes, isolated production build and production HTTP smoke pass (including visible thinking-task label and learner/teacher isolation). Genuine isolated Groq loop passes explain-error -> apply with two sound reasoning checks. No saved learner progress reset. Final interactive browser acceptance remains with the user.

D-024: Submission documentation package added: README, SRS, System Architecture, Testing & Validation. Existing test/live results are reported with limits; README calls for rerunning validation after the later Vercel Redis alias edit. No test commands run for documentation-only work.

D-025: Added the owner-provided Vercel URL to project and submission docs; hosted persistence and browser acceptance remain clearly marked unverified.
