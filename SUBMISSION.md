# Redpen — Product Space PS-02

## Live demo

[https://redpen-three.vercel.app/](https://redpen-three.vercel.app/)

The deployment URL was supplied by the project owner. Hosted Redis persistence and the latest production browser flow still require direct acceptance checks before describing them as independently verified.

## Problem

Generic tutors answer the latest question but often fail to track the learner’s understanding. Redpen focuses on the evidence in a student’s explanation, detects supported misconceptions, and adapts the next teaching task accordingly.

## Solution

Redpen is an adaptive Class 10 physics tutor with a concept graph, eight-question diagnostic, learner-specific evidence, misconception-aware teaching choices, task-diverse follow-ups, and spaced review. The tutor distinguishes conceptual misconceptions, calculation slips, sound reasoning, and uncertainty, including when a selected answer is correct but its explanation conflicts with the principle.

For supported topics, live Groq analysis classifies reasoning against a reviewed misconception taxonomy. The model proposes constrained question plans; deterministic server code renders the question and calculates the answer. Follow-ups can ask the learner to identify a principle, explain an error, apply it in a changed situation, or calculate independently. Two correct responses with sound reasoning across different generated task kinds are required before Redpen records improvement as observed.

## Teacher view and persistence

Students begin in signed anonymous guest sessions; no email signup is required. The teacher dashboard requires a configured access code and summarizes evidence from actual enrolled learners in the configured cohort. It does not display a synthetic class by default. Vercel deployments use per-learner Redis persistence.

## Scope and limitations

Current content covers 24 concepts and 40 reviewed questions, with seven generated question families across six concept areas. Unsupported or advanced formats remain reviewed-bank questions. Sources of Energy remains as legacy extension material. Redpen does not provide account recovery, institutional authentication, empirical educational validation, or large-scale operational guarantees. Mastery and confidence are estimates, not proof of permanent learning.

## Technology

Next.js 15, React 19, strict TypeScript, Groq `openai/gpt-oss-20b`, a deterministic physics question renderer/solver, the app’s versioned memory-store contract, and Redis REST persistence for Vercel.

## Submission documents

- [Software Requirements Specification](docs/SRS.md)
- [System Architecture](docs/SYSTEM-ARCHITECTURE.md)
- [Testing & Validation](docs/TESTING-VALIDATION.md)
- [Setup and full project guide](README.md)
