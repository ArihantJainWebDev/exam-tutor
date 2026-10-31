import { getStore, withStoreTransaction } from '@/platform';
import { loadPhysicsContent } from '@/lib/content.server';
import { createSessionService } from './session-service';
import { Nav } from '@/components/Nav';
import { TutorSession } from '@/components/TutorSession';
import { currentIdentity } from './auth';
import { getPersonalStore } from '@/platform/store/provider';
import { createMemoryStore } from '@/platform/store/memory';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;
export default async function TutorPage() {
  const content = await loadPhysicsContent();
  const identity = await currentIdentity();
  const initial = identity ? await withStoreTransaction(getPersonalStore(identity.id), store => createSessionService(store, content).view())
    : await createSessionService(createMemoryStore(), content).view();
  return <main className="doc"><Nav /><h1>Session</h1><TutorSession initial={initial} /></main>;
}
