import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMMIT_SCRIPT, createRedisStore } from '../src/platform/store/redis';
import { withStoreTransaction, getStore } from '../src/platform/store/provider';
import { loadPhysicsContent } from '../src/lib/content.server';
import { createSessionService } from '../src/app/tutor/session-service';
import { loadTeacherCohort } from '../src/app/tutor/teacher/cohort-service';

/** Controlled REST transport: exercises requests and CAS races, not a real hosted Redis. */
function redisTransport() {
  const keys = new Map<string, string>();
  let gets = 0, commits = 0;
  const fetchImpl: typeof fetch = async (_url, request) => {
    assert.equal(request?.cache, 'no-store');
    const args = JSON.parse(String(request?.body)) as (string | number)[];
    if (args[0] === 'GET') { gets++; return Response.json({ result: keys.get(String(args[1])) ?? null }); }
    assert.equal(args[0], 'EVAL'); assert.equal(args[1], COMMIT_SCRIPT); assert.equal(args[2], 1);
    const key = String(args[3]); const current = JSON.parse(keys.get(key) ?? '{"revision":0}');
    if (current.revision !== args[4]) return Response.json({ result: 0 });
    commits++; keys.set(key, String(args[5])); return Response.json({ result: 1 });
  };
  return { fetchImpl, keys, counts: () => ({ gets, commits }) };
}
const fact = (key: string, value: number, ns = 'tutor.mastery') => ({ namespace: ns, key, value, at: '2026-10-31T10:00:00Z', sourceId: 'test' });
const options = (fetchImpl: typeof fetch) => ({ url: 'https://redis.example', token: 'test-only', fetchImpl });

test('Redis contract persists version history and as-of views across independent store instances', async () => {
  const transport = redisTransport(); const first = createRedisStore(options(transport.fetchImpl));
  await first.put(fact('c', 1)); await first.put({ ...fact('c', 2), at: '2026-11-01T10:00:00Z' });
  const second = createRedisStore(options(transport.fetchImpl));
  assert.equal((await second.latest('tutor.mastery', 'c'))?.value, 2);
  assert.deepEqual((await second.history('tutor.mastery', 'c')).map(f => f.version), [1, 2]);
  assert.equal((await second.all('tutor.mastery', { before: '2026-10-31T12:00:00Z' }))[0].value, 1);
  await second.put(fact('x', 1, 'tutor.srs')); await second.reset('tutor.mastery');
  assert.deepEqual(await first.namespaces(), ['tutor.srs']);
});
test('concurrent Redis writes retry CAS without losing data or duplicating versions', async () => {
  const transport = redisTransport(); const a = createRedisStore(options(transport.fetchImpl)); const b = createRedisStore(options(transport.fetchImpl));
  await Promise.all([a.put(fact('c', 1)), b.put(fact('c', 2))]);
  assert.deepEqual((await a.history('tutor.mastery', 'c')).map(f => f.version), [1, 2]);
  assert.equal(transport.counts().commits, 2);
});
test('snapshot transaction commits all records once, and thrown work commits none', async () => {
  const transport = redisTransport(); const store = createRedisStore(options(transport.fetchImpl));
  await withStoreTransaction(store, async tx => { await tx.put(fact('c', 1)); await tx.put(fact('c', 2, 'tutor.srs')); });
  assert.equal(transport.counts().commits, 1);
  await assert.rejects(withStoreTransaction(store, async tx => { await tx.put(fact('c', 3)); throw new Error('interrupted'); }), /interrupted/);
  assert.equal((await store.latest('tutor.mastery', 'c'))?.value, 1); assert.equal(transport.counts().commits, 1);
});
test('two server instances submitting one answer produce one attempt and one mastery version', async () => {
  const transport = redisTransport(); const a = createRedisStore(options(transport.fetchImpl)); const b = createRedisStore(options(transport.fetchImpl));
  const content = await loadPhysicsContent();
  const initial = await withStoreTransaction(a, tx => createSessionService(tx, content).start('diagnostic'));
  const item = content.bank.find(i => i.id === initial.question!.id)!;
  const submit = (store: typeof a) => withStoreTransaction(store, tx => createSessionService(tx, content).answer({ token: initial.token, answer: String(item.answer), reasoning: item.explanation }));
  const [one, two] = await Promise.all([submit(a), submit(b)]);
  assert.equal(one.answered, 1); assert.equal(two.answered, 1);
  assert.equal((await b.all('tutor.attempt')).length, 1);
  assert.equal((await b.latest('tutor.mastery', item.conceptIds[0]))?.version, 1);
  assert.equal((await b.latest('tutor.srs', item.conceptIds[0]))?.version, 1);
});
test('teacher cohort seeds in one Redis commit and refresh does not reseed', async () => {
  const transport = redisTransport(); const store = createRedisStore(options(transport.fetchImpl)); const c = await loadPhysicsContent();
  await loadTeacherCohort(store, c); assert.equal(transport.counts().commits, 1);
  await loadTeacherCohort(store, c); assert.equal(transport.counts().commits, 1);
  assert.equal((await store.all('tutor.cohort.demo')).length, 20);
});
test('Redis failures and malformed snapshots fail explicitly rather than starting empty', async () => {
  const denied = createRedisStore(options(async () => new Response('', { status: 401 })));
  await assert.rejects(denied.namespaces(), /HTTP 401/);
  const broken = createRedisStore(options(async () => Response.json({ result: '{"revision":-1,"facts":[]}' })));
  await assert.rejects(broken.namespaces(), /refusing to overwrite/);
});
test('Vercel refuses ephemeral file fallback when Redis is not connected', () => {
  const keys = ['VERCEL', 'REDPEN_STORE', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN'] as const;
  const previous = keys.map(k => process.env[k]);
  try {
    keys.forEach(k => delete process.env[k]); process.env.VERCEL = '1';
    assert.throws(() => getStore(), /Connect Upstash Redis/);
  } finally { keys.forEach((k, i) => { if (previous[i] === undefined) delete process.env[k]; else process.env[k] = previous[i]; }); }
});
