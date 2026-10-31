# Redpen phase log

## Phase 1 â€” content foundation â€” 2026-10-31

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

### User browser evidence â€” 2026-10-31

Four supplied screenshots confirm the session preview (24 concepts/40 items, zero learner evidence), populated concept rows with prerequisites and "no evidence", teacher empty state, and learner-model empty state all render in mock mode. No error overlay is visible. The concept screenshot is partial; remaining chapter rows, refresh persistence, mobile layout, terminal and console errors are not established by these images.

Screenshot review found the session preview hardcoded a three-mark label for the one-mark first question. Corrected it to read `markAllocation` from the validated content loader. The updated mark needs a browser refresh check; the supplied screenshot shows the earlier value. This follow-up does not implement Phase 2.


## Phase 2 — diagnostic and adaptive tutor — 2026-10-31

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
