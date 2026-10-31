import type { Item } from './content';
/** Five chapter entry items, then electricity/light at mixed difficulty. */
export const DIAGNOSTIC_IDS = ['elec-01', 'light-01', 'eye-01', 'magnet-01', 'energy-01', 'elec-06', 'light-09', 'elec-09'] as const;
export function diagnosticItems(bank: Item[]): Item[] {
  return DIAGNOSTIC_IDS.map(id => {
    const item = bank.find(i => i.id === id);
    if (!item) throw new Error(`Missing diagnostic question ${id}.`);
    return item;
  });
}
