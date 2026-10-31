# Testing and Validation Report

| Field | Value |
|---|---|
| Product | Redpen — Adaptive Exam-Prep Tutor |
| Document | Testing and Validation Report |
| Version | 1.0 |
| Evidence date | 31 October 2026 |
| Status | Latest recorded implementation evidence; external deployment remains environment-dependent |

## 1. Purpose

This report explains how Redpen is checked, what the recorded results demonstrate, and what they do not prove. It accompanies the [Software Requirements Specification](SRS.md) and [System Architecture](SYSTEM-ARCHITECTURE.md) in the hackathon submission.

## 2. Validation approach

Redpen uses three complementary forms of evidence:

1. **Automated domain and adapter tests** verify deterministic behavior, validation boundaries, persistence semantics, identity scoping, and transactional state updates.
2. **Production build and HTTP smoke checks** verify that the deployable app compiles, required runtime files are bundled, route rendering works, and learner/teacher data boundaries behave in an isolated local production server.
3. **Live provider checks** exercise the Groq API with a fresh in-memory learner, checking reasoning analysis, constrained generation, and the correction-to-transfer flow without altering the saved local learner store.

These checks establish software behavior for their tested conditions. They do not demonstrate improved exam scores, institutional readiness, a security audit, or successful connection to the user’s live Vercel project.

## 3. Automated checks

Run from the Redpen app folder:

```powershell
npm run typecheck
npm test
npm run validate:content
npm run build
npm run smoke
```

| Check | What it covers |
|---|---|
| `npm run typecheck` | Strict TypeScript checks without emitting build files. |
| `npm test` | Node test suite through `tsx`; domain rules, content, LLM adapter, file and Redis stores, teacher aggregation, identity isolation, task diversity, and question solvers. |
| `npm run validate:content` | Physics graph, prerequisite edges, taxonomy links, question coverage, and answer/content shape. |
| `npm run build` | Optimized Next.js production build plus runtime-content and tracing checks. |
| `npm run smoke` | Starts the isolated production server and checks guest welcome, adaptive-task rendering, Graph/Model learner isolation, teacher access/cohort filtering, and absence of the retired generic LLM proxy. |

### Latest recorded automated result

The last recorded full verification, on 31 October 2026 after the adaptive-task work, reported **71 tests passing**, typecheck passing, isolated production build passing, and production HTTP smoke passing. The smoke included an adaptive-task label and learner/teacher isolation checks.

The Redis variable-alias compatibility change was made after that verification. This documentation update does not claim that the later alias-only code change was covered by the 71-test run. The commands above should be rerun before treating the current tree as freshly verified.

## 4. Live Groq validation

The live scripts load the private `.env.local` when run locally. They do not reset the existing learner store.

```powershell
npm run check:live
npm run check:live-learning
```

The recorded live learning check used isolated in-memory state and observed the following path:

1. The model classified a submitted reflection explanation containing a surface-versus-normal misconception and returned a verifiable quote.
2. Redpen generated an **explain-error** follow-up and independently rendered/graded its answer.
3. It generated an **apply** follow-up with a changed situation.
4. Both follow-ups received correct answers and sound reasoning classifications at 0.95 confidence; the learner model marked improvement observed only after the distinct task checks.

The sequence passed against Groq without fixtures. A prior repeated run experienced a provider interruption before succeeding on retry; live provider availability is not guaranteed. This is evidence for one scripted scenario, not a benchmark of model accuracy across students or topics.

The generation checker and five-question synthetic generation sequence also passed during investigation of invalid response formats. Those are bounded live observations, not an unlimited generation guarantee.

## 5. Requirement-to-evidence matrix

| Requirement area | Verification evidence | Remaining limit |
|---|---|---|
| Concept graph and reviewed content | Content validation and content unit tests | Content completeness and independent subject-matter review are not established for every board revision. |
| Mastery updates | Deterministic update tests and learning-session tests | Calibration against real exam performance is not established. |
| Reasoning diagnosis | Classifier schema/quote validation tests and live reflection scenario | Accuracy across varied writing, languages, learners, and all misconception types is unmeasured. |
| Adaptive task diversity | Task policy, task family/solver tests, distinct-task learning lifecycle test, live explain-error → apply scenario | Only seven generated families are supported; unsupported topics use reviewed-bank questions. |
| Answer correctness | Independent solver tests for generated plans and reviewed-content numerical checks | This is not independent verification of every possible generated prompt outside the supported families. |
| Spaced repetition | Leitner scheduling, due-date, remediation, and persistence tests | Learning retention effectiveness has not been studied empirically. |
| Learner privacy/isolation | Signed identity and scoped-store tests; production smoke compares two isolated learners | No third-party security penetration test has been performed. |
| Teacher cohort | Aggregation tests and production smoke for teacher gate and cohort filtering | Real Vercel cohort data and classroom operations depend on deployment and enrollment. |
| Redis persistence | Redis adapter contract, concurrency, transaction, error and Vercel no-file-fallback tests | Hosted Redis credentials and deployed Vercel end-to-end persistence must be checked in the target project. |
| Groq integration | Live scripts against configured local credentials | Provider speed/limits vary; hosted environment and billing/quota behavior are external. |

## 6. Manual acceptance checklist

After deployment, verify these steps in a clean browser profile:

1. Open `/tutor`, start a diagnostic, answer and explain a question.
2. Confirm correctness comes from the item’s expected answer, then inspect the reasoning analysis and next teaching task.
3. For a supported misconception, confirm the follow-up targets its concept and presents a different thinking task where available.
4. Submit two distinct generated task types with correct answers and coherent reasoning; confirm improvement is recorded only after both.
5. Refresh the page and confirm feedback/progress persists under the same learner cookie.
6. Open `/tutor/graph` and `/tutor/debug`; confirm they show the current learner’s evidence.
7. Open `/tutor/teacher` while locked and confirm the access gate. Unlock with the configured code and verify only the chosen cohort appears.
8. Open a second clean profile and verify that learner evidence is isolated.
9. Confirm a real API failure is visible and no fixture analysis is presented as live output.
10. Redeploy with the same Redis key and confirm saved progress persists.

Do not run the seed command as a way to reset a single learner; it clears the local store. Use the in-product personal reset for local learner data. Do not clear production Redis while testing persistence.

## 7. Reproduction and troubleshooting

- If the site errors before serving a request on Vercel, confirm `REDPEN_STORE=redis`, a writable Redis REST URL/token pair, `SESSION_SECRET`, `TEACHER_ACCESS_CODE`, and model settings are present in the Production environment, then redeploy.
- Redpen supports the Vercel-provided `REDIS_KV_REST_API_URL` / `REDIS_KV_REST_API_TOKEN` names as well as standard Upstash and `KV_REST_API_*` names. Never use a read-only token.
- If a Groq request fails, preserve the displayed error and retry after provider recovery. The app intentionally does not substitute product fixtures.
- If a build runs beside `next dev`, use a separate output folder:

  ```powershell
  $env:REDPEN_BUILD_DIR=".next-production-check"
  npm run build
  npm run smoke
  ```

## 8. Evidence integrity and limitations

The UI’s mastery and confidence figures are model estimates. A passing test confirms programmed behavior for its inputs, not that the estimate is educationally calibrated. The local live checks use synthetic answers and in-memory state; they do not establish hosted persistence. The recorded production smoke uses isolated test data; it is not a security certification. The public deployment, Redis connection, and browser acceptance should only be described as verified after those exact checks pass in the target Vercel project.
