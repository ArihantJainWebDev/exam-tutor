import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Reads a JSON file, returning null when it does not exist yet (content lands in later phases). */
export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Lists `.json` fixture files in a directory, sorted by name. Empty when the directory is absent. */
export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith('.json')).sort();
  } catch {
    return [];
  }
}

/** Resolves a path inside this app's own folder. Products never read outside it. */
export function appPath(...segments: string[]): string {
  return path.join(process.cwd(), ...segments);
}
