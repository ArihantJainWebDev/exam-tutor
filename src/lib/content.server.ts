import { appPath, readJsonIfExists } from '@/platform';
import { parseContent, type PhysicsContent } from './content';

/** Server-side IO through the app platform; validate before exposing authored data. */
export async function loadPhysicsContent(): Promise<PhysicsContent> {
  const [graph, bank, misconceptions] = await Promise.all(
    ['graph', 'bank', 'misconceptions'].map(name =>
      readJsonIfExists<unknown>(appPath('content', 'physics', `${name}.json`))),
  );
  return parseContent({ graph, bank, misconceptions });
}
