import { generateFollowUp } from '../src/app/tutor/generator';
try { process.loadEnvFile('.env.local'); } catch { /* hosted environment */ }
const question = await generateFollowUp({ conceptId: 'light:reflection', difficulty: 1,
  goal: 'Verify understanding that angles are measured from the normal, using the complementary angle in a different situation.',
  previousQuestion: 'A ray makes 30 degrees with the mirror surface. Find incidence.', recentIds: [] });
if (!question) throw new Error('Expected generated reflection question');
console.log(JSON.stringify({ source: question.origin.source, family: question.origin.family, stem: question.stem, answer: question.answer, options: question.options }));
