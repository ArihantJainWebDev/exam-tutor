import { loadPhysicsContent } from '../src/lib/content.server';

const content = await loadPhysicsContent();
console.log(`[content] valid: ${content.graph.length} concepts, ${content.bank.length} questions, ${content.misconceptions.length} misconceptions.`);
