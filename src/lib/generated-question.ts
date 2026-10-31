import { createHash } from 'node:crypto';
import type { Item } from './content';
export const FAMILIES: Record<string, string[]> = {
  'elec:ohms-law': ['ohms-law'], 'elec:series-circuits': ['series-current', 'series-voltage'],
  'light:reflection': ['reflection-angle'], 'light:lens-power': ['lens-power'],
  'elec:power-energy': ['power-energy'], 'eye:vision-defects': ['myopia'],
};
export interface QuestionPlan { family: string; variant: 'a' | 'b'; parameters: Record<string, number> }
export interface GeneratedQuestion extends Item { origin: { source: 'live'; family: string; parameters: Record<string, number>; variant: string } }
const round = (n: number) => Math.round(n * 1000) / 1000;
/** A model proposes parameters; vetted renderers and solvers own the actual physics and answer key. */
export function buildGeneratedQuestion(value: unknown, conceptId: string, difficulty: 1 | 2 | 3): GeneratedQuestion {
  if (!value || typeof value !== 'object') throw new Error('Expected a question plan');
  const p = value as QuestionPlan;
  if (!FAMILIES[conceptId]?.includes(p.family) || !['a', 'b'].includes(p.variant) || !p.parameters || typeof p.parameters !== 'object' || Array.isArray(p.parameters)) throw new Error('Unsupported question family or variant');
  const usedParameters: Record<string, number> = {};
  function number(key: string, min: number, max: number) {
    const v = p.parameters[key]; if (!Number.isFinite(v) || v < min || v > max || !Number.isInteger(v)) throw new Error(`Invalid parameter ${key}: expected integer ${min}–${max}`); usedParameters[key] = v; return v;
  }
  let stem: string, answer: number, unit: string, distractors: number[], explanation: string;
  let misconceptionTags: string[] = [];
  switch (p.family) {
    case 'ohms-law': {
      const v = number('voltage', 2, 24);
      if (p.variant === 'a') { const r = number('resistance', 1, 12); answer = round(v / r); unit = 'A'; stem = `A laboratory resistor of ${r} ohm has ${v} V across it. What current flows?`; distractors = [v * r, round(r / v), v + r]; explanation = `I = V/R = ${v}/${r} = ${answer} A.`; }
      else { const i = number('current', 1, 8); answer = round(v / i); unit = 'ohm'; stem = `A circuit carries ${i} A when the potential difference is ${v} V. What is its resistance?`; distractors = [v * i, round(i / v), v + i]; explanation = `R = V/I = ${v}/${i} = ${answer} ohm.`; }
      misconceptionTags = ['m:resistance-length-only']; break;
    }
    case 'series-current': {
      const q = number('charge', 2, 30), t = number('time', 1, 10), bulbs = number('bulbs', 2, 4);
      answer = round(q / t); unit = 'A';
      stem = p.variant === 'a' ? `${q} C passes the first bulb in ${t} s in a steady series circuit containing ${bulbs} bulbs. What current passes the last bulb?`
        : `An ammeter before a chain of ${bulbs} series bulbs measures ${q} C passing in ${t} s. What would an ammeter after the last bulb read in this steady circuit?`;
      distractors = [round(answer / bulbs), round(answer * bulbs), 0];
      explanation = `I = Q/t = ${q}/${t} = ${answer} A. Charge does not accumulate in a steady series circuit, so the same current passes every bulb.`;
      misconceptionTags = ['m:current-consumed']; break;
    }
    case 'series-voltage': {
      const v = number('voltage', 3, 24), a = number('resistance1', 1, 10), b = number('resistance2', 1, 10);
      answer = round(v * b / (a + b)); unit = 'V'; stem = `Resistors of ${a} ohm and ${b} ohm are in series across ${v} V. Find the voltage across the ${b} ohm resistor.`;
      distractors = [v, round(v / 2), round(v * a / (a + b))]; explanation = `I = ${v}/(${a}+${b}) A. The voltage across ${b} ohm is I x ${b} = ${answer} V.`;
      misconceptionTags = ['m:series-voltage-same']; break;
    }
    case 'reflection-angle': {
      const angle = number('angle', 10, 80); answer = 90 - angle; unit = 'degrees';
      stem = p.variant === 'a' ? `A ray makes ${angle} degrees with a plane mirror's surface. What is its angle of incidence?`
        : `A reflected ray makes ${angle} degrees with the normal to a plane mirror. What angle does that ray make with the mirror surface?`;
      distractors = [angle, round(angle / 2), 90]; explanation = `The normal is perpendicular to the surface. The two angles add to 90 degrees, so the requested angle is 90 - ${angle} = ${answer} degrees.`;
      misconceptionTags = ['m:angle-from-surface']; break;
    }
    case 'lens-power': {
      const cm = number('focalLengthCm', 10, 100); const sign = p.variant === 'a' ? 1 : -1;
      answer = round(sign * 100 / cm); unit = 'D'; stem = `A ${sign > 0 ? 'convex' : 'concave'} lens has focal length ${sign * cm} cm. What is its power?`;
      distractors = [-answer, round(sign / cm), round(sign * cm / 100)]; explanation = `Convert focal length to metres: f = ${sign * cm / 100} m. P = 1/f = ${answer} D.`;
      misconceptionTags = ['m:ignores-sign-convention']; break;
    }
    case 'power-energy': {
      const w = number('powerWatts', 20, 2000), h = number('hours', 1, 8);
      answer = round(w * h / 1000); unit = 'kWh'; stem = `A ${w} W appliance runs for ${h} hours. How much electrical energy does it consume in kWh?`;
      distractors = [w, round(w / 1000), round(w * h)]; explanation = `E = Pt. ${w}/1000 kW x ${h} h = ${answer} kWh.`;
      misconceptionTags = ['m:power-is-energy']; break;
    }
    case 'myopia': {
      const d = number('farPointMetres', 2, 10); answer = round(-1 / d); unit = 'D';
      stem = `A myopic eye has a far point of ${d} m. What power should a correcting lens close to the eye have for viewing distant objects?`;
      distractors = [-answer, d, -d]; explanation = `The lens forms a virtual image of a distant object at the far point, so f = -${d} m and P = -1/${d} = ${answer} D.`;
      misconceptionTags = ['m:myopia-convex']; break;
    }
    default: throw new Error('Unsupported family');
  }
  const id = `generated:${createHash('sha256').update(JSON.stringify({ stem, answer, conceptId })).digest('hex').slice(0, 24)}`;
  const numbers = [...new Set([answer, ...distractors.map(round), answer + 2, round(answer / 3), answer + 5])].slice(0, 4);
  const options = numbers.map(n => `${n} ${unit}`); const shift = parseInt(id.slice(-2), 16) % options.length;
  const shuffled = [...options.slice(shift), ...options.slice(0, shift)];
  return { id, conceptIds: [conceptId], difficulty, kind: 'mcq', stem, options: shuffled, answer: `${answer} ${unit}`,
    reasoningPrompt: 'Why does this principle apply in this situation? Explain your reasoning.', explanation, misconceptionTags,
    markAllocation: difficulty === 1 ? 1 : difficulty === 2 ? 2 : 3,
    origin: { source: 'live', family: p.family, parameters: usedParameters, variant: p.variant } };
}


/** Strict transport schema supplements (never replaces) the independent solver. */
export function questionPlanSchema(families: string[], recentPlans: unknown[] = []): Record<string, unknown> {
  const fields: Record<string, string[]> = {
    'ohms-law': ['voltage', 'resistance', 'current'],
    'series-current': ['charge', 'time', 'bulbs'],
    'series-voltage': ['voltage', 'resistance1', 'resistance2'],
    'reflection-angle': ['angle'], 'lens-power': ['focalLengthCm'],
    'power-energy': ['powerWatts', 'hours'], 'myopia': ['farPointMetres'],
  };
  const previousAngles = new Set(recentPlans.flatMap(p => {
    if (!p || typeof p !== 'object') return [];
    const plan = p as { family?: string; parameters?: { angle?: number } };
    return plan.family === 'reflection-angle' && typeof plan.parameters?.angle === 'number' ? [plan.parameters.angle] : [];
  }));
  const shapes = families.map(family => ({ type: 'object', additionalProperties: false,
    properties: Object.fromEntries(fields[family].map(key => [key,
      family === 'reflection-angle'
        ? { type: 'integer', enum: Array.from({ length: 71 }, (_, i) => i + 10).filter(n => n !== 45 && !previousAngles.has(n)) }
        : { type: 'integer' }])), required: fields[family] }));
  return { type: 'object', additionalProperties: false, required: ['family', 'variant', 'parameters'],
    properties: { family: { type: 'string', enum: families }, variant: { type: 'string', enum: ['a', 'b'] },
      parameters: shapes.length === 1 ? shapes[0] : { anyOf: shapes } } };
}
