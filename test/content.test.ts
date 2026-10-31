import assert from 'node:assert/strict';
import { test } from 'node:test';
import graph from '../content/physics/graph.json';
import bank from '../content/physics/bank.json';
import misconceptions from '../content/physics/misconceptions.json';
import { parseContent, validateContent } from '../src/lib/content';
import { loadPhysicsContent } from '../src/lib/content.server';

const fixture = () => structuredClone({ graph, bank, misconceptions });
test('authored bank meets coverage and loads through the server loader', async () => {
  assert.deepEqual(validateContent(fixture()), []);
  const loaded = await loadPhysicsContent();
  assert.equal(loaded.graph.length, 24); assert.equal(loaded.bank.length, 40);
});
test('rejects malformed JSON shapes and duplicate identifiers', () => {
  assert.ok(validateContent(null).length);
  const data = fixture(); data.bank[1].id = data.bank[0].id;
  assert.match(validateContent(data).join('\n'), /duplicate id/);
  assert.throws(() => parseContent({ ...data, bank: [null] }), /invalid item schema/);
});
test('rejects dangling concepts, cycles and unrelated taxonomy tags', () => {
  const data = fixture();
  data.graph[0].prereqs = ['elec:potential'];
  data.bank[0].conceptIds = ['elec:missing'];
  data.bank[1].misconceptionTags = ['m:myopia-convex'];
  const errors = validateContent(data).join('\n');
  assert.match(errors, /cycle/); assert.match(errors, /unknown concept/); assert.match(errors, /unrelated misconception/);
});
test('rejects invalid answer keys, missing reasoning and concept over-attribution', () => {
  const data = fixture();
  data.bank[0].answer = 'not an option'; data.bank[1].reasoningPrompt = '';
  data.bank[2].conceptIds = ['elec:current', 'elec:potential', 'elec:ohms-law'];
  const errors = validateContent(data).join('\n');
  assert.match(errors, /exact answer/); assert.match(errors, /bank\[1\]/); assert.match(errors, /bank\[2\]/);
});
test('rejects lost coverage instead of silently shipping an incomplete bank', () => {
  const data = fixture(); data.bank = data.bank.filter(q => !q.conceptIds.includes('eye:dispersion'));
  assert.match(validateContent(data).join('\n'), /No question covers eye:dispersion/);
});
test('reviewed numerical answer keys match independent calculations', () => {
  const key = (id: string) => bank.find(q => q.id === id)?.answer;
  assert.equal(key('elec-03'), `${2 / 0.5} A`);
  assert.equal(key('elec-06'), `${12 / (2 + 4) * 4} V`);
  assert.equal(key('light-03'), `${Math.round(1 / (-1 / 10 + 1 / 30))} cm`);
  assert.equal(key('eye-05'), `${-1 / 2} D`);
  assert.equal(key('energy-05'), `${100 * 4 * 0.75 / 50} hours`);
});
