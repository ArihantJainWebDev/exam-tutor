# Physics content — Phase 1

Original practice questions, authored for Redpen. JSON arrays follow src/lib/content.ts.

| Chapter | Concepts | Questions |
|---|---:|---:|
| Electricity | 7 | 12 |
| Light: Reflection and Refraction | 6 | 10 |
| Human Eye and the Colourful World | 4 | 6 |
| Magnetic Effects of Electric Current | 5 | 7 |
| Sources of Energy (legacy/extension) | 2 | 5 |
| Total | 24 | 40 |

## Syllabus scope and sources

This is the five-chapter legacy NCERT Class 10 practice scope agreed in the project plan. It is not a claim of full current CBSE coverage. Sources of Energy was removed in rationalisation and is retained explicitly as extension practice. Consult the relevant examination year's official syllabus before using this as an exam checklist.

- [NCERT 2025–26 Science contents](https://www.ncert.nic.in/textbook/pdf/jesc1ps.pdf)
- [NCERT Class X rationalised-content notice](https://www.ncert.nic.in/pdf/BookletClass10.pdf)
- [NCERT Electricity chapter](https://www.ncert.nic.in/textbook/pdf/jesc111.pdf)
- [NCERT exemplar catalogue, including legacy physics units](https://ncert.nic.in/exemplar-problems.php?ln=hi)

## Content conventions

- MCQ answer is exact option text, not an unstable option index. Numbers include units in the option text. Phase 2 must compare canonical answers, not free-form reasoning text.
- All questions ask for reasoning. Misconception tags identify what a question can diagnose, not what every wrong answer means. Some questions have no applicable tag in the fixed 12-tag taxonomy; this is intentional and must not force a diagnosis.
- Difficulty is an authored initial band, not empirical calibration. All three bands are present per chapter; not every concept has three bands yet. The bank is finite; later selection must handle exhaustion/recent-item exclusions.
- Prerequisites describe pedagogical readiness, not a scientifically unique dependency graph. The validator rejects missing prerequisites and cycles.
- No student mastery is seeded by content. The server loader reads validated JSON; npm run seed validates content then resets learner evidence.

## Review record — 2026-10-31

Agent editorial pass reviewed all 40 stems, correct options, explanations, units and diagnostic mappings. Numerical checks include I=Q/t, V=W/Q, Ohm's law, R=rho L/A with constant-volume stretching, series/parallel resistance, E=Pt, signed mirror/lens equations, lens power and solar storage losses. Tests independently recompute representative numerical keys. Conceptual checks cover current conservation, virtual images, normal-based angles, accommodation, wavelength-dependent scattering, right-hand-rule viewing direction, parallel magnetic force, and overload versus short circuit.

This is an agent review, not a claim of independent teacher approval. A human physics review remains advisable before using the bank in real assessment. No live model generated or verified this bank.

Demo anchors: elec-05 (consumed current), light-01 (surface versus normal), elec-03 (arithmetic slip with correct formula), light-04 (refraction). See PROMPTS.md for scripted reasoning. A careless slip must not automatically trigger a misconception.

Run npm run validate:content for schema, links, DAG, coverage, taxonomy and option checks. npm test also exercises corruption cases and numerical regressions.
