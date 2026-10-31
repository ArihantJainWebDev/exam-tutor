import { getStore } from '@/platform';
import { loadPhysicsContent } from '@/lib/content.server';
import { createSessionService } from './session-service';
import { Nav } from '@/components/Nav';
import { TutorSession } from '@/components/TutorSession';

export const dynamic = 'force-dynamic';
export default async function TutorPage() {
  const content = await loadPhysicsContent();
  const initial = await createSessionService(getStore(), content).view();
  return <main className="doc"><Nav /><h1>Session</h1><TutorSession initial={initial} /></main>;
}
