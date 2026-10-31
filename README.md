# Redpen

Personal physics learning through evidence, correction and verification. The active plan is [docs/REDPEN-REAL-SOLUTION-PLAN.md](../docs/REDPEN-REAL-SOLUTION-PLAN.md); it supersedes the earlier shared demo architecture.

## The learning loop

Start a personal guest session -> answer and explain -> live Groq reasoning analysis -> targeted teaching decision -> a new validated follow-up -> evidence of improvement -> spaced review.

A supported misconception triggers a correction and verification. Generated verification requires two different thinking tasks answered correctly with coherent live reasoning evidence before marking improvement observed. Changing only the numbers does not satisfy this requirement. This is evidence, not proof of permanent mastery. A correct option with contradictory reasoning does not receive a normal understanding reward. Slips and unclear explanations get different teaching actions.

## Run locally in real mode

```powershell
npm ci
npm run setup:local
# Set LLM_API_KEY in .env.local to your Groq key.
npm run dev
```

Local configuration uses openai/gpt-oss-20b at the Groq OpenAI-compatible endpoint. setup:local creates private session/teacher secrets only if missing and does not print them or overwrite your model key. Our development environment is already configured.

Open /tutor at the printed address. Each browser gets its own signed HTTP-only learner cookie when starting. The same browser resumes progress; another browser gets another learner. No email signup is required. Guest sessions expire after 30 days and do not automatically transfer across devices. Keep SESSION_SECRET stable across deployments.

Use Reset my progress to clear only your learner evidence. Old shared demo records remain legacy data and are never silently assigned to a new guest. Do not run npm run seed to reset an individual student: that CLI clears the entire local store and now creates no synthetic cohort.

## Live AI and validated questions

Product requests always use the real model; MOCK_LLM does not enable a product fixture mode. API failures are visible and never replaced with fixture diagnoses. Controlled transports and explicit fixtures are retained only in automated tests.

Groq analyses reasoning for both correct and incorrect answers, restricted to known misconceptions. Quotes must match the student's text. The server supplies vetted correction principles/hints, independently grades selected answers and computes generated answer keys.

Seven generation families cover six concept areas: Ohm's law, series current/voltage, reflection angles, lens power, electrical energy and myopia correction. Generation is constrained to vetted simple/two-step formats. Advanced difficulty and unsupported concepts use the reviewed 40-item bank, labelled as such. Each supported family now offers principle identification, error explanation, changed-situation application and independent calculation. The teaching policy chooses the task from conceptual confusion, uncertainty or calculation slips and avoids the last two task types for that concept. The next practice question moves to another concept after verified improvement. Recent generated plans and content identities prevent exact repeats; rejected outputs leave progress intact and allow retry.

The diagnostic starts with reviewed syllabus items; targeted verification can be inserted when reasoning indicates a problem. Practice shows why a question was chosen and whether it came from a live generated plan or reviewed bank.

## Teacher and evidence views

/tutor/teacher requires the TEACHER_ACCESS_CODE configured in the private server environment. The code grants an expiring signed teacher session for REDPEN_COHORT_ID (default physics). It is not student signup. A Lock teacher view button signs out.

Teacher metrics come from enrolled guest learners' actual saved attempts, not a seeded class. An empty class stays empty. Students in another cohort are excluded. /tutor/graph and /tutor/debug expose only the current learner's evidence; the evidence page omits unanswered generated answer keys and global records.

## Persistence and Vercel

Local file writes now commit complete operations before acknowledging success. Redis uses one atomic compare-and-set snapshot per learner, so different learners do not share learning state or compete over one learning snapshot. A separate root snapshot contains registration and access limits. Credentials are server-side only.

Follow [DEPLOYMENT.md](DEPLOYMENT.md). Vercel requires connected Upstash REST storage and session/teacher secrets. Production refuses ephemeral-file fallback. The external Redis account and public deployment are not configured by this repository alone.

## Verification

```powershell
npm run validate:content
npm run typecheck
npm test
npm run build
npm run smoke
npm run check:live
npm run check:live-learning
```

The last two commands make actual Groq requests using your local key. They use an isolated learner and do not reset your progress. Tests and smoke checks use controlled inputs; that is not a product demo mode.

If a development server is running, isolate production artifacts:

```powershell
$env:REDPEN_BUILD_DIR=".next-production-check"
npm run build
npm run smoke
```

The smoke checks separate learner cookies on Graph/Model, teacher authorization and cohort filtering. Browser clicks, layout, actual Vercel/Redis connectivity and security review still need their own checks.

## Scope and docs

24 concepts across a legacy NCERT physics practice scope, including Sources of Energy extension material. This is not a claim of full current board coverage, empirically validated mastery calibration or production classroom readiness. Live provider latency/limits can affect response time. Guest identity is not full account recovery or institution-grade authentication.

[PHASE-LOG.md](PHASE-LOG.md) records the observed checks and limitations; [CHANGELOG.md](CHANGELOG.md) tracks changes. [DEMO.md](DEMO.md) and [SUBMISSION.md](SUBMISSION.md) describe release evidence without claiming deployment/video/filing are complete.

Stack: Next.js 15, React 19, strict TypeScript, app-owned CSS tokens/Tailwind layout, fetch-based Groq/Upstash adapters and Node tests through tsx. This repository remains independent from PS 03.

## Task diversity check

For reflection, a diagnosed surface/normal misconception now leads to explaining a mistaken solution, then applying reflection to the angle between laser ray paths. Numerical correctness is computed independently. The interface displays the thinking task. The same four task categories are supported by all seven generation families; unsupported concepts and advanced questions remain labelled reviewed-bank practice.

Existing saved sessions continue without a reset. Older untyped verification evidence is retained in history but cannot establish diverse task completion; new qualifying tasks build that evidence.
