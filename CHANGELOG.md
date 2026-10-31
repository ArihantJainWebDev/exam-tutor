# Redpen changelog

## 2026-10-31 - Phase 4 feature work implemented

- Added deterministic 20-learner/800-answer teacher simulation through the real mastery model.
- Added heatmap, gap ranking, simulated misconception counts, supported risk flags and learner drill-down.
- Added user-approved Upstash REST persistence for Vercel with atomic snapshot CAS and concurrent-answer idempotency. Local development still supports files.
- Removed the unused public model proxy; bundled runtime content explicitly and excluded local learner data from tracing.
- Seed CLI now resets local learner evidence and seeds the separate teacher cohort. Automated checks use disposable stores.
- Added isolated production HTTP smoke, Vercel deployment guide, submission pack and current demo script.
- 52 tests, typecheck, content validation, production build and all-route HTTP smoke pass. Real hosted Redis/Vercel and final video/filing remain pending.
- User reports NVIDIA API success; actual in-app live-source verification remains a release check.

## 2026-10-31 - Phase 3 implemented

- Added closed-set reasoning analysis through callLlm, exact-quote validation and taxonomy-backed feedback.
- Added four scripted fixture variants plus conservative default; disclose live, mock, fallback and unavailable analysis.
- Apply supported misconception penalties only to relevant concepts and persist source/evidence.
- Added per-concept Leitner review schedules, visible queue and due/remediation selection hooks.
- Old sessions remain usable; no automatic reset or retrospective classification.
- 38 tests, typecheck, content validation and production build pass. Build required elevated filesystem access after a Windows EPERM.
- Phase 3 browser interaction and actual NVIDIA access remain unverified. Teacher dashboard remains Phase 4.

## 2026-10-31 � Phase 2 implemented

- Added eight-item diagnostic, bounded Rasch mastery, adaptive bank selection and server-owned grading.
- Added answer/reasoning form, feedback, mastery evidence and saved sessions with refresh/resume.
- Added duplicate/stale submission handling and per-process mutation serialisation.
- Added 11 learning/session tests; all 27 tests, content validation, typecheck and production build pass.
- Browser interaction acceptance pending. Misconception analysis and SRS remain Phase 3.


## 2026-10-31 — Phase 1 implemented

- Adopted four phases: content foundation; adaptive tutor with diagnostic; misconception feedback and spaced review; teacher dashboard and submission.
- Added 24 concepts, 40 questions, 12 misconception definitions, typed content validation and loading.
- Added `validate:content`, six content tests and validated graph-page loading; seed validates content before resetting evidence.
- Validation, typecheck and production build pass; 16 tests pass. Mock-mode server starts; local HTTP verification blocked by environment connectivity.
- Scope is legacy NCERT Class 10 physics; Sources of Energy is extension practice, not a claim about current board coverage.
- NVIDIA configuration exists locally; live connectivity remains unverified.

### Browser review follow-up

- User screenshots confirm all four mock-mode pages render with populated concepts and expected empty states.
- Fixed the question preview's hardcoded mark allocation and switched it to the validated content loader; browser confirmation of the corrected mark remains pending.


Phase 3 browser follow-up: user screenshots confirm fixture-labelled misconception feedback, quoted evidence, mastery change, review dates and saved model records. Live NVIDIA access and refresh/mobile checks remain unverified.

Phase 4 build follow-up: verify-runtime-files.mjs checks required runtime content and strips local data/test/env references from generated function manifests across path conventions.


## Real solution revision D-019

Personal guest identities and teacher authorization; per-learner Redis snapshots; durable local transactions; real class evidence; live-only NVIDIA reasoning and constrained generation; explicit teaching decisions and two-check verification lifecycle; no product fixture fallback. 63 regression tests pass. Full live learning loop observed successfully.


## D-020 - Groq provider migration

Replaced NVIDIA defaults, environment example, current setup documentation and UI labels with Groq openai/gpt-oss-20b. Groq GPT-OSS uses max_completion_tokens and low reasoning effort; keys remain server-side and local secrets were preserved. Full live diagnosis -> two distinct generated follow-ups -> improvement-observed passed in approximately five seconds. Product remains live-only.


## D-021 - Strict generated-question format

Investigated the reported reflection answer: 50 degrees to surface correctly yields 40 degrees incidence. Reproduced live generation rejection on synthetic inputs: variant beta then uppercase A violated the renderer contract. Groq GPT-OSS generation now uses a strict JSON schema with lowercase variant enums, closed parameter objects and unused reflection angles; independent solvers and duplicate validation remain mandatory. Validation retries include the rejected assistant response. Notices distinguish invalid output, throttling and provider/transport failure. Five consecutive synthetic live generations and the complete isolated live transfer loop pass. No private learner history transmitted and no learner state reset.


## D-022 - Meaningful adaptive task diversity

Added four independently graded thinking tasks across the seven supported generation families: identify a principle, explain an error, apply a principle to a changed situation, and calculate. Teaching actions and recent task history choose the next kind; generated verification requires two different kinds of task, not numerical variants. Correct improvement moves practice to another concept while retaining spaced reviews. Task labels and reasoning prompts explain the change. Saved sessions remain compatible; legacy untyped checks do not fabricate diverse evidence. Live Groq check passed error-explanation followed by application with sound reasoning at 0.95 confidence for both. Reviewed-bank fallback remains explicit outside supported generation.

## D-024 Documentation package

Replaced the short README with a polished product overview and local/Vercel setup guide. Added submission-ready SRS, System Architecture, and Testing & Validation documents under docs/. Verification results are dated and explicitly caveat the Redis alias edit made after the 71-test record; no tests were run for this documentation task.

## D-025 Live deployment link

Added the owner-provided https://redpen-three.vercel.app/ URL to the README, deployment guide, and submission overview. Documentation distinguishes the supplied URL from unverified hosted Redis persistence/browser acceptance.
