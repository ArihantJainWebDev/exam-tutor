# Deploy Redpen on Vercel

Status: adapter and build configuration are implemented. No Vercel project or live Redis connection has been provisioned or verified by this agent. The complete local live Groq correction/transfer loop has passed; hosted verification remains pending.

## 1. Import the repository

Import `ArihantJainWebDev/exam-tutor` into your Vercel account. Select Next.js. This repository already is the app root: use `.` as Root Directory. Do not include the sibling hackathon app or upload local .env files. Use the repository's Node-compatible default runtime (Node 22 is used in the optional container).

## 2. Connect persistent storage

From the project's Storage or Marketplace area, add **Upstash for Redis** and connect it to the project. Follow the integration's account, region and plan prompts; review any cost before provisioning. Redpen supports either set of server-side environment names:

| Standard Upstash names | Vercel integration aliases |
|---|---|
| `UPSTASH_REDIS_REST_URL` | `KV_REST_API_URL` |
| `UPSTASH_REDIS_REST_TOKEN` | `KV_REST_API_TOKEN` |

The Vercel Redis integration may instead provide `REDIS_KV_REST_API_URL` and `REDIS_KV_REST_API_TOKEN`. Redpen now reads that pair directly as well; you do not need to duplicate either secret.

Use a write-capable REST token, not a read-only token or just a `REDIS_URL` TCP connection string. Never use a `NEXT_PUBLIC_` prefix. No Redis SDK is needed: the adapter uses the REST API.

Set `REDPEN_STORE=redis`. Without a REST URL and token, Redpen deliberately refuses to run on Vercel rather than pretending its local files are persistent. For a local-only run, keep the default `auto` and omit Redis credentials, or use `file`.

## 3. Configure the model

Set these in the Vercel project's Environment Variables:

```env
LLM_API_KEY=<your Groq key>
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-20b
MOCK_LLM=0
CACHE_LLM=0
REDPEN_STORE=redis
REDPEN_REDIS_KEY=redpen:production:v1
```

The storage integration supplies the URL/token separately. For a fixture rehearsal, use `MOCK_LLM=1` and disclose fixture mode. Use a distinct `REDPEN_REDIS_KEY`, such as `redpen:preview:v1`, for preview deployments so preview experiments do not alter the production demo. Copying environment variables requires a redeployment before existing functions use them.

## 4. Deploy and verify

1. Deploy the current commit. Open `/tutor`, `/tutor/graph`, `/tutor/teacher`, and `/tutor/debug`.
2. Complete a diagnostic answer. Refresh: feedback and evidence must remain.
3. Open the same deployment in a second browser window: it should show the same shared demo learner.
4. Redeploy without changing the Redis key and check the answer still exists. Do not reset Redis between these checks.
5. In live mode, submit a wrong answer with reasoning for a supported misconception. Confirm feedback says **Live model analysis**. A **Fixture fallback** badge means live analysis failed; it must not be described as a live success.
6. Teacher view should show 20 simulated learners and 800 answer events. Inspect another learner and check that the figures change; refresh must not regenerate different data or erase your own progress.
7. Check layout on a narrow screen and console/network errors. Never put API/storage tokens in the video or screenshots.

The unused generic `/api/llm` proxy has been removed. Domain server actions grade and analyse bounded question attempts.

## Storage behavior and limitations

Redis holds a versioned **whole-demo snapshot** under the configured key. Each hosted answer action reads one snapshot, computes all attempt/mastery/SRS/session updates, and commits them together using compare-and-set. A racing request re-reads and retries; duplicate answer tokens remain idempotent. Reads do not silently fall back to a fresh empty file if Redis is unavailable.

This is a hackathon demo store for one shared learner and a small simulated cohort. It sends the snapshot over REST and retains history; it is not designed for an unlimited production classroom. Authentication, individual accounts, schema migration and production rate limits are outside this submission. Public visitors share and can change the same demo learner's progress.

`npm run seed` is a **local-file reset**: stop the local server first. It does not clear hosted Redis. To deliberately start a separate hosted demo, change `REDPEN_REDIS_KEY` to a fresh key and redeploy; retain the old key if its evidence is still needed. The teacher cohort initialises automatically in its own namespaces.

## Optional container path

The Dockerfile supports a normal single-instance Node host. Mount a writable persistent directory at `/app/data`, or configure Redis as above. Container build/run has not been tested here. Do not rely on the container's writable layer alone for persistence.

## Official setup references

- [Upstash integration on Vercel](https://vercel.com/marketplace/upstash/upstash-kv)
- [Vercel function filesystem limitations](https://vercel.com/docs/functions/runtimes)
- [Upstash REST command and scripting support](https://upstash.com/docs/redis/features/restapi)


## Active real-solution revision (supersedes shared-demo instructions above)

Set SESSION_SECRET to a stable random value of at least 32 characters, TEACHER_ACCESS_CODE to a strong private value of at least 12 characters, and REDPEN_COHORT_ID=physics. npm run setup:local generates local secrets if missing; copy appropriate secret values into Vercel's server environment without publishing them. Do not rotate SESSION_SECRET between normal deployments: existing signed guest sessions depend on it.

Product model calls are live-only. MOCK_LLM does not turn on a product demo mode. Both correct and incorrect reasoning are analysed; unavailable calls are labelled and do not use fixtures. Teacher requires the configured access code and shows real enrolled guests, never an automatically seeded class. Each learner uses a separate Redis key under the configured prefix; root storage holds registration/access limits.

Enable Vercel Fluid compute for the configured 180-second function budget (provider latency can be significant). Reference: https://vercel.com/docs/functions/configuring-functions/duration . Real hosted Redis and public deployment remain unverified until you connect the services.

Guest sessions last up to 30 days in one browser; teacher access expires after eight hours. This is scoped guest/teacher authorization, not full email signup or cross-device account recovery. Use private own-progress reset for an individual learner. The seed CLI clears the whole local store and now creates no fictional cohort.
