# Redpen changelog

## 2026-10-31 — Phase 2 implemented

- Added eight-item diagnostic, bounded Rasch mastery, adaptive bank selection and server-owned grading.
- Added answer/reasoning form, feedback, mastery evidence and saved sessions with refresh/resume.
- Added duplicate/stale submission handling and per-process mutation serialisation.
- Added 11 learning/session tests; all 27 tests, content validation, typecheck and production build pass.
- Browser interaction acceptance pending. Misconception analysis and SRS remain Phase 3.


## 2026-10-31 â€” Phase 1 implemented

- Adopted four phases: content foundation; adaptive tutor with diagnostic; misconception feedback and spaced review; teacher dashboard and submission.
- Added 24 concepts, 40 questions, 12 misconception definitions, typed content validation and loading.
- Added `validate:content`, six content tests and validated graph-page loading; seed validates content before resetting evidence.
- Validation, typecheck and production build pass; 16 tests pass. Mock-mode server starts; local HTTP verification blocked by environment connectivity.
- Scope is legacy NCERT Class 10 physics; Sources of Energy is extension practice, not a claim about current board coverage.
- NVIDIA configuration exists locally; live connectivity remains unverified.

### Browser review follow-up

- User screenshots confirm all four mock-mode pages render with populated concepts and expected empty states.
- Fixed the question preview's hardcoded mark allocation and switched it to the validated content loader; browser confirmation of the corrected mark remains pending.
