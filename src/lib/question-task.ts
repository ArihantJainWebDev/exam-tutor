import type { Item } from './content';
import type { TeachingDecision } from './teaching';

export const QUESTION_TASKS = ['identify-principle', 'explain-error', 'apply', 'calculate'] as const;
export type QuestionTask = typeof QUESTION_TASKS[number];
export const TASK_LABELS: Record<QuestionTask, string> = {
  'identify-principle': 'Identify the principle', 'explain-error': 'Explain the error',
  apply: 'Apply in a new situation', calculate: 'Solve independently',
};

/** A teaching action chooses the thinking required; changing numbers alone is not progression. */
export function chooseQuestionTask(action: TeachingDecision['action'], recentTasks: QuestionTask[]): QuestionTask {
  const preferred: Record<TeachingDecision['action'], QuestionTask[]> = {
    'correct-misconception': ['explain-error', 'identify-principle', 'apply', 'calculate'],
    clarify: ['identify-principle', 'explain-error', 'apply', 'calculate'],
    'check-calculation': ['calculate', 'apply', 'explain-error', 'identify-principle'],
    'verify-understanding': ['apply', 'calculate', 'explain-error', 'identify-principle'],
    advance: ['apply', 'calculate', 'explain-error', 'identify-principle'],
  };
  const order = preferred[action];
  return order.find(task => !recentTasks.slice(-2).includes(task)) ?? order.find(task => task !== recentTasks.at(-1))!;
}

type TaskContent = Pick<Item, 'stem' | 'answer' | 'options' | 'explanation' | 'reasoningPrompt'>;
interface TaskInput { family: string; variant: string; parameters: Record<string, number>; task: QuestionTask; base: TaskContent }
const round = (n: number) => Math.round(n * 1000) / 1000;

/** Reviewed conceptual statements and arithmetic own every key; the model cannot supply one. */
export function renderQuestionTask({ family, variant, parameters: p, task, base }: TaskInput): TaskContent {
  if (task === 'calculate') return base;
  let stem: string, answer: string, wrong: string[], explanation: string;
  const principles: Record<string, [string, string, string[]]> = {
    'reflection-angle': ['Which reference line defines the angle of incidence at a plane mirror?',
      'The normal, perpendicular to the mirror at the point of incidence',
      ['The mirror surface', 'Any line parallel to the incoming ray', 'The edge of the mirror']],
    'ohms-law': ['For an ohmic resistor at constant temperature, which relationship is valid?', 'Current equals voltage divided by resistance',
      ['Current equals voltage multiplied by resistance', 'Current equals resistance divided by voltage', 'Current is independent of voltage']],
    'series-current': ['In a steady circuit with bulbs connected in series, which statement explains the current?', 'The same charge per second passes every bulb',
      ['Each bulb consumes some current', 'The final bulb always receives zero current', 'Current divides equally among series bulbs']],
    'series-voltage': ['Two unequal resistors are in series across a battery. How is the battery voltage shared?', 'Voltage drop is proportional to resistance because current is the same',
      ['Every resistor always has the full battery voltage', 'Voltage is always divided equally', 'The larger resistance has a smaller voltage drop']],
    'lens-power': ['Which relationship correctly connects lens power and focal length?', 'Power is the reciprocal of signed focal length in metres',
      ['Power is the reciprocal of focal length in centimetres', 'Every lens has positive power', 'Power equals focal length in metres']],
    'power-energy': ['What distinguishes electrical power from electrical energy?', 'Power is energy transferred per unit time',
      ['Power and energy are the same quantity', 'Energy is always measured in watts', 'Power is time divided by energy']],
    myopia: ['Why does a myopic eye need a diverging lens for distant objects?', 'It forms a virtual image at the far point so the eye can focus on the retina',
      ['It converges the rays further before they enter the eye', 'It moves the retina closer to the lens', 'It gives the eye an infinite focal length']],
  };
  if (task === 'identify-principle') {
    [stem, answer, wrong] = principles[family];
    stem = `${base.stem} Before solving, consider: ${stem}`;
    explanation = answer + '.';
  } else if (task === 'explain-error') {
    switch (family) {
      case 'reflection-angle':
        stem = `A student sees a ray ${p.angle} degrees from the mirror surface and writes: "The incidence angle is ${p.angle} degrees because incidence is measured from the surface." Which correction addresses the mistake?`;
        answer = 'Measure incidence from the normal; subtract the surface angle from 90 degrees';
        wrong = ['Keep the surface angle; incidence is measured from the surface', 'Divide the surface angle by two', 'Incidence is always 90 degrees'];
        explanation = `Incidence is measured from the normal, not the surface. Here it is 90 - ${p.angle} = ${90 - p.angle} degrees.`; break;
      case 'ohms-law':
        stem = `A student uses I = V × R for a resistor supplied with ${p.voltage} V. Which correction should they make?`;
        answer = 'Divide voltage by resistance to find current';
        wrong = ['Multiply voltage by resistance to find current', 'Divide resistance by voltage to find current', 'Add resistance to voltage to find current'];
        explanation = 'Ohm’s law is V = IR, so I = V/R, not V × R.'; break;
      case 'series-current':
        stem = `A student says: "The last of ${p.bulbs} series bulbs receives less current because earlier bulbs use it up." What is wrong?`;
        answer = 'Bulbs transfer electrical energy; current is the same throughout a steady series circuit';
        wrong = ['Each bulb consumes charge permanently', 'Current falls by the same amount at every bulb', 'Only the first bulb carries current'];
        explanation = 'Charge is conserved. Bulbs transfer energy, while the same charge per second passes each bulb.'; break;
      case 'series-voltage':
        stem = `A student claims that each of two series resistors across ${p.voltage} V has ${p.voltage} V across it. Which correction is valid?`;
        answer = 'The voltage drops add to the battery voltage and divide in proportion to resistance';
        wrong = ['Each series resistor always gets the full battery voltage', 'Current must be different in the two resistors', 'Every pair of series resistors must divide voltage equally'];
        explanation = 'Series resistors share the same current. V₁ + V₂ equals the supply, with each drop given by IR.'; break;
      case 'lens-power':
        stem = `A student uses P = 1/${p.focalLengthCm} for a ${variant === 'a' ? 'convex' : 'concave'} lens with focal length magnitude ${p.focalLengthCm} cm and reports positive dioptres. Which method is valid?`;
        answer = 'Convert focal length to metres and keep its sign before taking the reciprocal';
        wrong = ['Use centimetres directly and always take positive power', 'Multiply focal length by 100 and keep centimetres', 'Use the focal length itself as power'];
        explanation = 'P = 1/f uses metres. Convex lenses have positive focal length and power; concave lenses have negative values.'; break;
      case 'power-energy':
        stem = `A student says a ${p.powerWatts} W appliance uses the same energy whether it runs for one hour or ${p.hours + 1} hours. Which correction is needed?`;
        answer = 'Energy equals power multiplied by time, so longer operation uses more energy';
        wrong = ['The watt rating is already the total energy used', 'Energy decreases as running time increases', 'Energy is independent of running time'];
        explanation = 'Power is a rate, not a total. E = Pt; at fixed power, energy is proportional to operating time.'; break;
      case 'myopia':
        stem = `A student recommends a converging lens for a myopic eye with far point ${p.farPointMetres} m. Why is that the wrong type?`;
        answer = 'Myopia needs a diverging lens with negative power to form a virtual image at the far point';
        wrong = ['Myopia always requires a positive-power lens', 'A lens cannot correct myopia', 'The correcting lens must form a real image behind the eye'];
        explanation = `For a distant object, the corrective lens forms a virtual image at the far point: f = -${p.farPointMetres} m, so power is negative.`; break;
      default: throw new Error('Unsupported error-analysis family');
    }
  } else {
    let value: number, unit: string, alternatives: number[];
    switch (family) {
      case 'reflection-angle':
        stem = `In a laser alignment setup, the incoming ray makes ${p.angle} degrees with a plane mirror's surface. What angle is formed between the incident and reflected ray paths on the same side of the mirror?`;
        value = 2 * (90 - p.angle); unit = 'degrees'; alternatives = [90 - p.angle, p.angle, 2 * p.angle];
        explanation = `Incidence is 90 - ${p.angle} = ${90 - p.angle} degrees. Reflection has the same angle to the normal, so the angle between the ray paths is 2 × ${90 - p.angle} = ${value} degrees.`; break;
      case 'ohms-law': {
        const initialCurrent = variant === 'a' ? round(p.voltage / p.resistance) : p.current;
        stem = `An ohmic resistor at constant temperature initially carries ${initialCurrent} A. The supply voltage doubles while resistance stays fixed. What current will it carry?`;
        value = round(2 * initialCurrent); unit = 'A'; alternatives = [initialCurrent, initialCurrent / 2, 0];
        explanation = `I = V/R. With R fixed, doubling V doubles I to ${value} A.`; break;
      }
      case 'series-current':
        stem = `A steady series circuit has ${p.bulbs} bulbs and initially carries ${p.charge} C in ${p.time} s past each bulb. A switch in the only conducting loop is opened. What is the steady current through the last bulb after the switch opens?`;
        value = 0; unit = 'A'; alternatives = [round(p.charge / p.time), round(p.charge / p.time / p.bulbs), p.bulbs];
        explanation = 'Opening the only loop breaks the complete conducting path. The steady current through every series bulb becomes 0 A.'; break;
      case 'series-voltage': {
        const b = 2 * p.resistance2;
        stem = `A ${p.voltage} V supply feeds ${p.resistance1} ohm and ${p.resistance2} ohm resistors in series. The second resistor is replaced by ${b} ohm, leaving the supply unchanged. Find the new voltage across the replacement.`;
        value = round(p.voltage * b / (p.resistance1 + b)); unit = 'V'; alternatives = [p.voltage, round(p.voltage / 2), round(p.voltage * p.resistance2 / (p.resistance1 + p.resistance2))];
        explanation = `Recalculate current using the new total resistance: I = ${p.voltage}/(${p.resistance1}+${b}) A. Then V = I × ${b} = ${value} V.`; break;
      }
      case 'lens-power': {
        const f = (variant === 'a' ? 1 : -1) * p.focalLengthCm;
        stem = `A ${variant === 'a' ? 'convex' : 'concave'} lens has focal length ${f} cm. It is replaced by a lens of the same type with half that focal length. What is the replacement lens's power?`;
        value = round(200 / f); unit = 'D'; alternatives = [round(100 / f), round(50 / f), round(-200 / f)];
        explanation = `The new focal length is ${f / 2} cm = ${f / 200} m. P = 1/f = ${value} D; halving focal length doubles signed power.`; break;
      }
      case 'power-energy':
        stem = `A ${p.powerWatts} W appliance runs for ${p.hours} hours. Electricity costs Rs 6 per kWh. What is the energy cost, ignoring other charges?`;
        value = round(p.powerWatts * p.hours / 1000 * 6); unit = 'rupees'; alternatives = [round(p.powerWatts * p.hours / 1000), round(p.powerWatts / 1000 * 6), p.powerWatts * p.hours * 6];
        explanation = `Energy = ${p.powerWatts}/1000 × ${p.hours} kWh. Multiply by Rs 6 per kWh: cost = Rs ${value}.`; break;
      case 'myopia':
        stem = `A myopic eye's far point changes from ${p.farPointMetres} m to ${p.farPointMetres / 2} m. What power is now required for a corrective lens close to the eye to view distant objects?`;
        value = round(-2 / p.farPointMetres); unit = 'D'; alternatives = [round(-1 / p.farPointMetres), round(2 / p.farPointMetres), -p.farPointMetres];
        explanation = `The virtual image must be at the new far point, so f = -${p.farPointMetres / 2} m. P = 1/f = ${value} D.`; break;
      default: throw new Error('Unsupported application family');
    }
    answer = `${value} ${unit}`;
    wrong = [...new Set([...alternatives.map(round), value + 1, value + 3])].filter(n => n !== value).slice(0, 3).map(n => `${n} ${unit}`);
  }
  return { stem, answer, options: [answer, ...wrong], explanation,
    reasoningPrompt: task === 'explain-error' ? 'Explain why the proposed reasoning fails and how you would correct it.'
      : task === 'identify-principle' ? 'Explain why this principle applies and why one other option is wrong.'
      : 'Explain how you transferred the principle to this changed situation. Show each step.' };
}
