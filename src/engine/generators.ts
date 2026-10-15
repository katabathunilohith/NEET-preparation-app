import type { Difficulty, MistakeType, Question } from '../types';
import { int, pick, rng, shuffle } from './random';

/**
 * Question generators. Each one produces unlimited fresh variants of a NEET concept
 * (new numbers, new fact pairings, new distractors), so practice never runs dry and
 * the engine can target exactly the concepts and mistake types where she struggles.
 * A generated question's id is `gen:<generatorId>:<seed>`, so it can be rebuilt any
 * time from its id alone, with nothing extra stored.
 */

/** numeric = calculation practice, recall = facts to remember, reasoning = applying a rule. */
export type GenKind = 'numeric' | 'recall' | 'reasoning';

interface Built {
  text: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Generator {
  id: string;
  chapterId: string;
  concept: string;
  kind: GenKind;
  difficulty: Difficulty;
  make: (r: () => number) => Built;
}

/** Which kind of generated question best trains each mistake type. */
export const KIND_FOR_MISTAKE: Record<MistakeType, GenKind[]> = {
  calculation: ['numeric'],
  time: ['numeric'],
  memory: ['recall'],
  guess: ['recall', 'reasoning'],
  concept: ['reasoning', 'numeric'],
  misread: ['reasoning', 'recall'],
};

// ── helpers ──────────────────────────────────────────────

/** Formats a number compactly: up to `dp` decimals, trailing zeros trimmed. */
export function fmt(x: number, dp = 2): string {
  if (!Number.isFinite(x)) return String(x);
  const s = x.toFixed(dp);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Builds a 4-option MCQ from the correct option and candidate distractors (deduplicated). */
function mcq(r: () => number, correct: string, candidates: string[], text: string, explanation: string): Built {
  const wrong: string[] = [];
  for (const c of shuffle(candidates, r)) if (c !== correct && !wrong.includes(c) && wrong.length < 3) wrong.push(c);
  let k = 2;
  while (wrong.length < 3) {
    const filler = /^-?[\d.]+/.test(correct) ? correct.replace(/^-?[\d.]+/, (m) => fmt(Number(m) * k)) : `None of these (${k})`;
    if (filler !== correct && !wrong.includes(filler)) wrong.push(filler);
    k++;
  }
  const options = shuffle([correct, ...wrong], r);
  return { text, options, answer: options.indexOf(correct), explanation };
}

function num(r: () => number, correct: number, wrongs: number[], unit: string, text: string, explanation: string, dp = 2): Built {
  const f = (x: number) => `${fmt(x, dp)}${unit ? ` ${unit}` : ''}`;
  return mcq(r, f(correct), wrongs.filter((w) => Number.isFinite(w) && Math.abs(w - correct) > 1e-9).map(f), text, explanation);
}

const frac = (n: number, d: number) => {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const k = g(Math.abs(n), Math.abs(d));
  return d / k === 1 ? `${n / k}` : `${n / k}/${d / k}`;
};

type Row = [string, string];

/**
 * Turns a fact table into two generators: "item → attribute" and (when attributes are
 * unique) "attribute → item". Distractors come from the other rows, so they are always plausible.
 */
function facts(
  id: string,
  chapterId: string,
  concept: string,
  rows: Row[],
  forward: (item: string) => string,
  reverse?: (attr: string) => string,
  difficulty: Difficulty = 'medium',
): Generator[] {
  const gens: Generator[] = [
    {
      id: `${id}-f`,
      chapterId,
      concept,
      kind: 'recall',
      difficulty,
      make: (r) => {
        const [item, attr] = pick(r, rows);
        return mcq(r, attr, rows.map((x) => x[1]), forward(item), `${item} → ${attr}.`);
      },
    },
  ];
  if (reverse) {
    gens.push({
      id: `${id}-r`,
      chapterId,
      concept,
      kind: 'recall',
      difficulty,
      make: (r) => {
        const [item, attr] = pick(r, rows);
        const others = rows.filter((x) => x[1] !== attr).map((x) => x[0]);
        return mcq(r, item, others, reverse(attr), `${item} → ${attr}.`);
      },
    });
  }
  return gens;
}

const G = 10;

// ── physics ──────────────────────────────────────────────

const PHYSICS: Generator[] = [
  {
    id: 'kin-maxh', chapterId: 'p-kinematics', concept: 'Vertical motion', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const u = pick(r, [10, 15, 20, 25, 30, 40, 50]);
      const h = (u * u) / (2 * G);
      return num(r, h, [2 * h, h / 2, (u * u) / G / 4, u / 2], 'm', `A ball is thrown straight up at ${u} m/s. Maximum height reached (g = 10 m/s²)?`, `H = u²/2g = ${u * u}/20 = ${fmt(h)} m.`);
    },
  },
  {
    id: 'kin-flight', chapterId: 'p-kinematics', concept: 'Time of flight', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const u = pick(r, [10, 20, 25, 30, 40, 45]);
      const t = (2 * u) / G;
      return num(r, t, [u / G, 4 * u / G, t + 1], 's', `A stone thrown vertically upward at ${u} m/s returns to the thrower's hand after (g = 10 m/s²)`, `Up and down each take u/g, total 2u/g = ${fmt(t)} s.`);
    },
  },
  {
    id: 'kin-range', chapterId: 'p-kinematics', concept: 'Projectile range', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const u = pick(r, [10, 20, 30, 40]);
      const th = pick(r, [15, 45, 75]);
      const s2 = th === 45 ? 1 : 0.5;
      const R = (u * u * s2) / G;
      return num(r, R, [R * 2, R / 2, (u * u) / G === R ? R * 4 : (u * u) / G, (u * u * s2) / (2 * G)], 'm', `A projectile is launched at ${u} m/s at ${th}° to the horizontal. Its horizontal range is (g = 10 m/s²)`, `R = u² sin2θ / g = ${u * u} × ${s2} / 10 = ${fmt(R)} m.`);
    },
  },
  {
    id: 'laws-fma', chapterId: 'p-laws', concept: "Newton's second law", kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const m = int(r, 2, 12), a = int(r, 1, 6), F = m * a;
      return num(r, a, [F * m, m / F, a + 1, F - m], 'm/s²', `A net force of ${F} N acts on a ${m} kg block. Its acceleration is`, `a = F/m = ${F}/${m} = ${a} m/s².`);
    },
  },
  {
    id: 'laws-atwood', chapterId: 'p-laws', concept: 'Atwood machine', kind: 'numeric', difficulty: 'hard',
    make: (r) => {
      const m1 = int(r, 1, 5), m2 = m1 + int(r, 1, 4);
      const a = ((m2 - m1) * G) / (m1 + m2);
      return num(r, a, [((m2 - m1) * G) / m2, ((m2 - m1) * G) / m1, (m2 * G) / (m1 + m2)], 'm/s²', `Masses ${m1} kg and ${m2} kg hang over a light frictionless pulley. Acceleration of the system (g = 10 m/s²)?`, `a = (m₂ − m₁)g/(m₁ + m₂) = ${m2 - m1}×10/${m1 + m2} = ${fmt(a)} m/s².`);
    },
  },
  {
    id: 'wep-kep', chapterId: 'p-wep', concept: 'KE–momentum relation', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const x = pick(r, [10, 20, 50, 100, 200]);
      const ke = ((1 + x / 100) ** 2 - 1) * 100;
      return num(r, ke, [x, 2 * x, x * x / 100 + x / 2, ke / 2], '%', `If the momentum of a body increases by ${x}%, its kinetic energy increases by`, `KE = p²/2m ⇒ factor (1 + ${x / 100})² = ${fmt((1 + x / 100) ** 2)} ⇒ +${fmt(ke)}%.`);
    },
  },
  {
    id: 'wep-power', chapterId: 'p-wep', concept: 'Power', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const m = pick(r, [20, 50, 60, 100]), h = pick(r, [5, 10, 15, 20]), t = pick(r, [2, 4, 5, 10]);
      const P = (m * G * h) / t;
      return num(r, P, [m * h / t, m * G * h, P * 2, P / G], 'W', `A motor lifts ${m} kg through ${h} m in ${t} s. Minimum power needed (g = 10 m/s²)?`, `P = mgh/t = ${m}×10×${h}/${t} = ${fmt(P)} W.`);
    },
  },
  ...facts('rot-mi', 'p-rot', 'Moment of inertia', [
    ['a thin ring about its central axis', 'MR²'],
    ['a disc about its central axis', 'MR²/2'],
    ['a solid sphere about a diameter', '2MR²/5'],
    ['a hollow sphere about a diameter', '2MR²/3'],
    ['a thin rod about its centre (⊥ to length)', 'ML²/12'],
    ['a thin rod about one end (⊥ to length)', 'ML²/3'],
  ], (x) => `Moment of inertia of ${x} is`, (a) => `Which body has moment of inertia ${a} about the stated axis?`),
  ...facts('rot-roll', 'p-rot', 'Rolling motion', [
    ['ring', '1/2'],
    ['disc', '1/3'],
    ['solid sphere', '2/7'],
    ['hollow sphere', '2/5'],
  ], (x) => `For a ${x} rolling without slipping, rotational KE ÷ total KE equals`, undefined, 'hard'),
  {
    id: 'grav-height', chapterId: 'p-grav', concept: 'Variation of g with height', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const k = pick(r, [1, 2, 3, 0.5]);
      const label = k === 0.5 ? 'R/2' : k === 1 ? 'R' : `${k}R`;
      const ans = k === 0.5 ? '4g/9' : `g/${(k + 1) ** 2}`;
      return mcq(r, ans, ['g/2', 'g/4', 'g/9', 'g/16', '4g/9', `g/${k + 1}`, '2g/3'], `At a height ${label} above Earth's surface (R = radius of Earth), acceleration due to gravity becomes`, `g' = g/(1 + h/R)² = g/(${fmt(1 + k)})² = ${ans}.`);
    },
  },
  {
    id: 'units-err', chapterId: 'p-units', concept: 'Error propagation', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const p = int(r, 1, 3), q = int(r, 1, 2), s = int(r, 1, 2);
      const ea = int(r, 1, 3), eb = int(r, 1, 3), ec = int(r, 1, 4);
      const tot = p * ea + q * eb + s * ec / 2;
      return num(r, tot, [ea + eb + ec, p * ea + q * eb - s * ec / 2, p * ea + q * eb + s * ec, tot * 2], '%', `X = a${p > 1 ? `^${p}` : ''} b${q > 1 ? `^${q}` : ''} / c${s === 1 ? '^½' : ''}. Percentage errors in a, b and c are ${ea}%, ${eb}% and ${ec}%. Maximum percentage error in X is`, `ΔX/X = ${p}(${ea}) + ${q}(${eb}) + ${s === 1 ? '½' : s / 2}(${ec}) = ${fmt(tot)}%. Errors always add.`);
    },
  },
  {
    id: 'thermo-carnot', chapterId: 'p-thermo', concept: 'Carnot engine', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const [T1, T2] = pick(r, [[400, 300], [500, 300], [600, 300], [800, 400], [1000, 500], [800, 600], [500, 400]] as const);
      const eta = (1 - T2 / T1) * 100;
      const c1 = T1 - 273, c2 = T2 - 273;
      return num(r, eta, [(1 - c2 / c1) * 100, (T2 / T1) * 100, eta / 2], '%', `A Carnot engine works between ${c1} °C and ${c2} °C. Its efficiency is`, `Use kelvin: η = 1 − ${T2}/${T1} = ${fmt(eta)}%. Using °C directly is the classic trap.`, 1);
    },
  },
  {
    id: 'ktg-rms', chapterId: 'p-ktg', concept: 'RMS speed', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const [t1, t2] = pick(r, [[27, 927], [-73, 527], [27, 327], [127, 1327]] as const);
      const ratio = Math.sqrt((t2 + 273) / (t1 + 273));
      return num(r, ratio, [ratio * ratio, (t2 + 273) / (t1 + 273) / 2, Math.sqrt(t2 / Math.max(1, Math.abs(t1)))], 'times', `A gas is heated from ${t1} °C to ${t2} °C. Its rms speed becomes`, `v ∝ √T: √(${t2 + 273}/${t1 + 273}) = ${fmt(ratio)} times.`);
    },
  },
  {
    id: 'osc-pend', chapterId: 'p-osc', concept: 'Simple pendulum', kind: 'reasoning', difficulty: 'easy',
    make: (r) => {
      const k = pick(r, [4, 9, 16, 0.25]);
      const f = Math.sqrt(k);
      return num(r, f, [k, 1 / f, k / 2], 'times', `If the length of a simple pendulum is made ${k === 0.25 ? 'one-fourth' : `${k} times`}, its time period becomes`, `T ∝ √L ⇒ ×√${k} = ${fmt(f)}.`);
    },
  },
  {
    id: 'waves-pipe', chapterId: 'p-waves', concept: 'Organ pipes', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const L = pick(r, [0.25, 0.5, 0.85, 1, 1.7]);
      const closed = r() < 0.5;
      const f = closed ? 340 / (4 * L) : 340 / (2 * L);
      return num(r, f, [closed ? 340 / (2 * L) : 340 / (4 * L), 340 / L, 3 * f], 'Hz', `Fundamental frequency of a ${closed ? 'closed' : 'open'} organ pipe ${L} m long (speed of sound 340 m/s) is`, `${closed ? 'Closed: f = v/4L' : 'Open: f = v/2L'} = ${fmt(f)} Hz.`, 1);
    },
  },
  {
    id: 'charges-coulomb', chapterId: 'p-charges', concept: "Coulomb's law", kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const a = pick(r, [2, 3, 1]), d = pick(r, [2, 3, 0.5]);
      const factor = (a * a) / (d * d);
      return num(r, factor, [a / d, (a * a) / d, a / (d * d), factor * 2], '× F', `Two point charges repel with force F. If both charges are multiplied by ${a} and their separation by ${d}, the new force is`, `F ∝ q₁q₂/r² ⇒ ${a}×${a}/${d}² = ${fmt(factor)} F.`);
    },
  },
  {
    id: 'cap-combo', chapterId: 'p-capacitance', concept: 'Capacitor combinations', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const c1 = pick(r, [2, 3, 4, 6]), c2 = pick(r, [3, 6, 12]);
      const series = r() < 0.6;
      const v = series ? (c1 * c2) / (c1 + c2) : c1 + c2;
      return num(r, v, [series ? c1 + c2 : (c1 * c2) / (c1 + c2), Math.abs(c1 - c2), (c1 + c2) / 2], 'μF', `${c1} μF and ${c2} μF capacitors are connected in ${series ? 'series' : 'parallel'}. Equivalent capacitance?`, series ? `1/C = 1/${c1} + 1/${c2} ⇒ C = ${fmt(v)} μF.` : `Parallel: C = ${c1} + ${c2} = ${v} μF.`);
    },
  },
  {
    id: 'cur-terminal', chapterId: 'p-current', concept: 'EMF and terminal voltage', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const E = pick(r, [2, 3, 6, 12]), rin = pick(r, [0.5, 1, 2]), R = pick(r, [2, 4, 5, 10]);
      const V = (E * R) / (R + rin);
      return num(r, V, [E, (E * rin) / (R + rin), E / R, E - rin], 'V', `A cell of emf ${E} V and internal resistance ${rin} Ω is connected across ${R} Ω. Terminal voltage?`, `I = ${E}/${R + rin}; V = IR = ${fmt(V)} V.`);
    },
  },
  {
    id: 'cur-stretch', chapterId: 'p-current', concept: 'Resistance and stretching', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const n = pick(r, [2, 3, 4]);
      return num(r, n * n, [n, 1 / n, 2 * n], '× R', `A wire is stretched to ${n} times its length (volume constant). Its resistance becomes`, `R ∝ L²/V ⇒ ${n}² = ${n * n} R.`);
    },
  },
  {
    id: 'cur-parallel', chapterId: 'p-current', concept: 'Resistor combinations', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const [a, b] = pick(r, [[3, 6], [4, 12], [6, 12], [2, 2], [10, 15], [6, 3]] as const);
      const p = (a * b) / (a + b);
      return num(r, p, [a + b, Math.abs(a - b), (a + b) / 2], 'Ω', `${a} Ω and ${b} Ω resistors in parallel have an equivalent resistance of`, `R = ${a}×${b}/(${a}+${b}) = ${fmt(p)} Ω.`);
    },
  },
  {
    id: 'mag-radius', chapterId: 'p-magnetic', concept: 'Charged particle in B', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const a = pick(r, [2, 3]), b = pick(r, [2, 3, 0.5]);
      return num(r, a / b, [a * b, b / a, (a * a) / b], '× r', `A charged particle moves in a circle in uniform B. If its speed is made ${a} times and B is made ${b} times, the radius becomes`, `r = mv/qB ⇒ ${a}/${b} = ${fmt(a / b)}.`);
    },
  },
  {
    id: 'emi-motional', chapterId: 'p-emi', concept: 'Motional emf', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const B = pick(r, [0.2, 0.5, 1, 2]), l = pick(r, [0.5, 1, 2]), v = pick(r, [2, 5, 10]);
      return num(r, B * l * v, [(B * v) / l, (B * l) / v, B * l * v * 2], 'V', `A ${l} m rod moves at ${v} m/s perpendicular to a ${B} T field. Induced emf?`, `ε = Blv = ${fmt(B * l * v)} V.`);
    },
  },
  {
    id: 'ac-rms', chapterId: 'p-ac', concept: 'RMS value', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const k = pick(r, [5, 10, 20, 50]);
      return mcq(r, `${k} A`, [`${k}√2 A`, `${k * 2} A`, `${k / 2} A`, `${k / 1.414 >= 1 ? fmt(k / 1.414) : k} A`], `An AC current has peak value ${k}√2 A. Its rms value is`, `I_rms = I₀/√2 = ${k} A.`);
    },
  },
  {
    id: 'ray-power', chapterId: 'p-ray', concept: 'Lens power', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const f = pick(r, [10, 20, 25, 40, 50, -20, -25, -50]);
      const P = 100 / f;
      const sign = (x: number) => (x > 0 ? `+${fmt(x)}` : fmt(x));
      return mcq(r, `${sign(P)} D`, [`${sign(-P)} D`, `${sign(f / 100)} D`, `${sign(P * 10)} D`, `${sign(1 / f)} D`], `A ${f > 0 ? 'convex' : 'concave'} lens has focal length ${Math.abs(f)} cm. Its power is`, `P = 100/f(cm) = ${sign(P)} D.`);
    },
  },
  {
    id: 'ray-mirror', chapterId: 'p-ray', concept: 'Mirror formula', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const [f, u] = pick(r, [[10, 15], [10, 20], [10, 30], [15, 30], [20, 30], [20, 60], [12, 36], [15, 20]] as const);
      const v = (u * f) / (u - f);
      return num(r, v, [u, f, (u * f) / (u + f), u - f], 'cm', `An object is ${u} cm in front of a concave mirror of focal length ${f} cm. Distance of the image from the mirror?`, `1/v = 1/f − 1/u = 1/${f} − 1/${u} ⇒ v = ${fmt(v)} cm (real, in front).`);
    },
  },
  {
    id: 'wo-fringe', chapterId: 'p-wave-optics', concept: "Young's double slit", kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const lam = pick(r, [400, 500, 600]), D = pick(r, [1, 1.5, 2]), d = pick(r, [0.2, 0.5, 1]);
      const b = (lam * D) / d / 1000;
      return num(r, b, [b * 10, b / 10, (lam * d) / D / 1000], 'mm', `In YDSE, λ = ${lam} nm, screen distance D = ${D} m and slit separation d = ${d} mm. Fringe width?`, `β = λD/d = ${lam}×10⁻⁹ × ${D} / ${d}×10⁻³ = ${fmt(b)} mm.`, 3);
    },
  },
  {
    id: 'dual-db', chapterId: 'p-dual', concept: 'de Broglie wavelength', kind: 'numeric', difficulty: 'hard',
    make: (r) => {
      const V = pick(r, [100, 400, 900, 2500, 10000]);
      const l = 12.27 / Math.sqrt(V);
      return num(r, l, [12.27 / V, l * 10, 12.27 * Math.sqrt(V) / 100], 'Å', `de Broglie wavelength of an electron accelerated through ${V} V is about`, `λ = 12.27/√V Å = 12.27/${Math.sqrt(V)} = ${fmt(l, 3)} Å.`, 3);
    },
  },
  {
    id: 'dual-pe', chapterId: 'p-dual', concept: 'Photoelectric effect', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const phi = pick(r, [2, 2.3, 3, 4.2]), E = phi + pick(r, [0.5, 1, 1.7, 2.5]);
      const k = E - phi;
      return num(r, k, [E, phi, E + phi], 'eV', `Light of photon energy ${fmt(E)} eV falls on a metal of work function ${phi} eV. Maximum KE of photoelectrons?`, `K_max = hν − φ = ${fmt(E)} − ${phi} = ${fmt(k)} eV.`);
    },
  },
  {
    id: 'atoms-level', chapterId: 'p-atoms', concept: 'Energy levels', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const [n2, n1] = pick(r, [[2, 1], [3, 1], [3, 2], [4, 2], [4, 1]] as const);
      const e = 13.6 * (1 / (n1 * n1) - 1 / (n2 * n2));
      return num(r, e, [13.6 / (n2 * n2), 13.6 / (n1 * n1), 13.6 * (1 / n1 - 1 / n2)], 'eV', `Energy of the photon emitted when a hydrogen electron falls from n = ${n2} to n = ${n1}?`, `ΔE = 13.6(1/${n1 * n1} − 1/${n2 * n2}) = ${fmt(e)} eV.`);
    },
  },
  {
    id: 'nuc-half', chapterId: 'p-nuclei', concept: 'Half-life', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const T = pick(r, [2, 5, 10, 20]), k = int(r, 2, 4);
      const decayed = r() < 0.4;
      const rem = 1 / 2 ** k;
      const ans = decayed ? frac(2 ** k - 1, 2 ** k) : frac(1, 2 ** k);
      return mcq(r, ans, [frac(1, 2 ** k), frac(2 ** k - 1, 2 ** k), frac(1, k), frac(1, 2 * k), frac(1, 2 ** (k + 1))], `A sample has a half-life of ${T} days. Fraction ${decayed ? 'decayed' : 'remaining'} after ${T * k} days?`, `${k} half-lives ⇒ remaining (1/2)^${k} = ${fmt(rem, 4)}${decayed ? `, so decayed = ${ans}` : ''}.`);
    },
  },
  ...facts('semi-gates', 'p-semi', 'Logic gates', [
    ['AND', 'Output 1 only when both inputs are 1'],
    ['OR', 'Output 0 only when both inputs are 0'],
    ['NAND', 'Output 0 only when both inputs are 1'],
    ['NOR', 'Output 1 only when both inputs are 0'],
    ['XOR', 'Output 1 only when the inputs differ'],
  ], (g) => `Which statement describes the ${g} gate?`, (a) => `Which gate has this behaviour: “${a}”?`),
];

// ── chemistry ────────────────────────────────────────────

const MOLAR: [string, number][] = [['H₂O', 18], ['CO₂', 44], ['NaOH', 40], ['NaCl', 58.5], ['CaCO₃', 100], ['H₂SO₄', 98], ['glucose (C₆H₁₂O₆)', 180], ['NH₃', 17], ['O₂', 32]];

const CHEMISTRY: Generator[] = [
  {
    id: 'mole-mass', chapterId: 'c-basic', concept: 'Mole concept', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const [name, M] = pick(r, MOLAR);
      const n = pick(r, [0.1, 0.25, 0.5, 2, 3]);
      const m = n * M;
      return num(r, n, [n * 10, M / m, n * 2, n / 2], 'mol', `How many moles are present in ${fmt(m)} g of ${name}?`, `n = mass/M = ${fmt(m)}/${M} = ${n} mol.`, 3);
    },
  },
  {
    id: 'molarity', chapterId: 'c-basic', concept: 'Molarity', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const [name, M] = pick(r, MOLAR.slice(2, 7));
      const n = pick(r, [0.05, 0.1, 0.2, 0.5]), V = pick(r, [250, 500, 1000, 200]);
      const g = n * M;
      const mol = n / (V / 1000);
      return num(r, mol, [n, n * (V / 1000), mol / 10, mol * 2], 'M', `${fmt(g)} g of ${name} is dissolved to make ${V} mL of solution. Molarity?`, `n = ${fmt(g)}/${M} = ${n} mol; M = n/V(L) = ${n}/${V / 1000} = ${fmt(mol)} M.`, 3);
    },
  },
  {
    id: 'molecules', chapterId: 'c-basic', concept: 'Avogadro number', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const n = pick(r, [0.5, 2, 0.1, 1.5]);
      const f = (x: number) => `${fmt(x, 3)} × 10²³`;
      return mcq(r, f(6.022 * n), [f(6.022 / n), f(6.022 * n * 2), f(6.022 * n * 3), `${fmt(6.022 * n, 3)} × 10²²`], `Number of molecules in ${n} mol of a gas is`, `N = n × Nₐ = ${n} × 6.022 × 10²³.`);
    },
  },
  {
    id: 'qn-electrons', chapterId: 'c-atom', concept: 'Quantum numbers', kind: 'reasoning', difficulty: 'easy',
    make: (r) => {
      if (r() < 0.5) {
        const l = int(r, 0, 3);
        const e = 2 * (2 * l + 1);
        return num(r, e, [2 * l + 1, 2 * l, 4 * l + 1, e + 4], '', `Maximum number of electrons in a subshell with l = ${l} is`, `2(2l + 1) = ${e}.`);
      }
      const n = int(r, 2, 4);
      return num(r, 2 * n * n, [n * n, 2 * n, n * n * n], '', `Maximum number of electrons in the shell with n = ${n} is`, `2n² = ${2 * n * n}.`);
    },
  },
  {
    id: 'ph', chapterId: 'c-equil', concept: 'pH', kind: 'numeric', difficulty: 'easy',
    make: (r) => {
      const k = int(r, 1, 5);
      const base = r() < 0.5;
      const pH = base ? 14 - k : k;
      const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹'[k];
      return num(r, pH, [base ? k : 14 - k, pH + 1, pH - 1], '', `pH of 10⁻${sup} M ${base ? 'NaOH' : 'HCl'} solution (25 °C) is`, base ? `pOH = ${k} ⇒ pH = 14 − ${k} = ${pH}.` : `[H⁺] = 10⁻${sup} ⇒ pH = ${k}.`, 0);
    },
  },
  ...facts('redox-on', 'c-redox', 'Oxidation number', [
    ['Cr in K₂Cr₂O₇', '+6'], ['Mn in KMnO₄', '+7'], ['N in HNO₃', '+5'], ['N in NH₃', '−3'], ['O in H₂O₂', '−1'],
    ['O in OF₂', '+2'], ['Mn in MnO₂', '+4'], ['S in H₂SO₄', '+6'], ['Fe in Fe₃O₄', '+8/3'], ['O in KO₂', '−1/2'],
  ], (x) => `Oxidation number of ${x} is`),
  {
    id: 'kin-first', chapterId: 'c-kinetics', concept: 'First-order kinetics', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const t = pick(r, [10, 20, 30, 69.3, 6.93]);
      const which = int(r, 0, 2);
      if (which === 0) return num(r, 0.693 / t, [t / 0.693, 1 / t, 0.693 * t], 'min⁻¹', `Half-life of a first-order reaction is ${t} min. Rate constant k?`, `k = 0.693/t½ = ${fmt(0.693 / t, 4)} min⁻¹.`, 4);
      const [pct, mult] = which === 1 ? [75, 2] : [87.5, 3];
      return num(r, t * mult, [t * (pct / 100), t * 1.5, t * 4], 'min', `A first-order reaction has t½ = ${t} min. Time for ${pct}% completion?`, `${pct}% done = ${mult} half-lives = ${fmt(t * mult)} min.`);
    },
  },
  {
    id: 'faraday', chapterId: 'c-electro', concept: "Faraday's laws", kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const [ion, z] = pick(r, [['Ag⁺', 1], ['Cu²⁺', 2], ['Al³⁺', 3], ['Zn²⁺', 2], ['Na⁺', 1]] as const);
      const n = pick(r, [0.5, 1, 2]);
      return num(r, z * n, [n, z, z * n * 2, n / z], 'F', `Charge needed to deposit ${n} mol of metal from ${ion}?`, `Each ion needs ${z} electron(s): ${n} × ${z} = ${fmt(z * n)} F.`);
    },
  },
  ...facts('vant-hoff', 'c-solutions', "van't Hoff factor", [
    ['glucose', '1'], ['NaCl', '2'], ['K₂SO₄', '3'], ['AlCl₃', '4'], ['K₄[Fe(CN)₆]', '5'],
  ], (x) => `van't Hoff factor (i) of ${x} assuming complete dissociation is`, (a) => `Which solute has van't Hoff factor ${a} (complete dissociation)?`),
  ...facts('hybrid', 'c-bonding', 'Hybridisation', [
    ['BeCl₂', 'sp'], ['BF₃', 'sp²'], ['CH₄', 'sp³'], ['PCl₅', 'sp³d'], ['SF₆', 'sp³d²'], ['IF₇', 'sp³d³'],
  ], (x) => `Hybridisation of the central atom in ${x} is`, (a) => `Central atom has ${a} hybridisation in`),
  ...facts('shape', 'c-bonding', 'VSEPR shapes', [
    ['XeF₂', 'Linear'], ['XeF₄', 'Square planar'], ['SF₄', 'See-saw'], ['ClF₃', 'T-shaped'], ['NH₃', 'Trigonal pyramidal'],
    ['H₂O', 'Bent'], ['BF₃', 'Trigonal planar'], ['IF₇', 'Pentagonal bipyramidal'],
  ], (x) => `Shape of ${x} is`, (a) => `Which molecule is ${a.toLowerCase()}?`, 'medium'),
  ...facts('bond-order', 'c-bonding', 'Bond order (MOT)', [
    ['N₂', '3'], ['O₂', '2'], ['O₂⁺', '2.5'], ['O₂⁻', '1.5'], ['O₂²⁻', '1'], ['He₂⁺', '0.5'],
  ], (x) => `Bond order of ${x} is`, (a) => `Which species has bond order ${a}?`, 'hard'),
  {
    id: 'mag-moment', chapterId: 'c-dfblock', concept: 'Magnetic moment', kind: 'numeric', difficulty: 'hard',
    make: (r) => {
      const [ion, n] = pick(r, [['Ti³⁺', 1], ['V³⁺', 2], ['Cr³⁺', 3], ['Fe²⁺', 4], ['Mn²⁺', 5], ['Ni²⁺', 2], ['Cu²⁺', 1], ['Co²⁺', 3]] as const);
      const mu = Math.sqrt(n * (n + 2));
      return mcq(r, `${fmt(mu)} BM`, [1, 2, 3, 4, 5].filter((x) => x !== n).map((x) => `${fmt(Math.sqrt(x * (x + 2)))} BM`), `Spin-only magnetic moment of ${ion} is`, `${ion} has ${n} unpaired electron(s): μ = √(${n}×${n + 2}) = ${fmt(mu)} BM.`);
    },
  },
  ...facts('named-rxn', 'c-carbonyl', 'Named reactions', [
    ['Etard reaction', 'Toluene → benzaldehyde (CrO₂Cl₂)'],
    ['Rosenmund reduction', 'Acyl chloride → aldehyde (H₂, Pd-BaSO₄)'],
    ['Clemmensen reduction', 'C=O → CH₂ (Zn-Hg / conc. HCl)'],
    ['Wolff–Kishner reduction', 'C=O → CH₂ (NH₂NH₂ / KOH, glycol)'],
    ['Cannizzaro reaction', 'Aldehyde without α-H → alcohol + carboxylate'],
    ['Aldol condensation', 'Aldehyde with α-H → β-hydroxy aldehyde'],
    ['HVZ reaction', 'Carboxylic acid → α-halo acid'],
  ], (x) => `${x} achieves which conversion?`, (a) => `Which reaction does this: ${a}?`),
  ...facts('named-rxn2', 'c-alcohols', 'Named reactions', [
    ['Reimer–Tiemann reaction', 'Phenol → salicylaldehyde'],
    ['Kolbe reaction', 'Sodium phenoxide + CO₂ → salicylic acid'],
    ['Williamson synthesis', 'Alkyl halide + alkoxide → ether'],
    ['Lucas test', 'Distinguishes 1°, 2°, 3° alcohols'],
  ], (x) => `${x} is used for`, (a) => `Which reaction/test: ${a}?`),
  ...facts('amine-rxn', 'c-amines', 'Amine reactions', [
    ['Hoffmann bromamide degradation', 'Amide → 1° amine with one carbon less'],
    ['Gabriel phthalimide synthesis', 'Pure aliphatic 1° amines'],
    ['Carbylamine reaction', 'Test for 1° amines (foul-smelling isocyanide)'],
    ['Hinsberg test', 'Distinguishes 1°, 2°, 3° amines'],
    ['Sandmeyer reaction', 'Diazonium salt → aryl halide (CuX)'],
  ], (x) => `${x} is used for`, (a) => `Which reaction/test: ${a}?`),
  ...facts('lab-tests', 'c-practical', 'Functional group tests', [
    ['Tollens’ reagent', 'Aldehydes (silver mirror)'],
    ['Neutral FeCl₃', 'Phenols (violet colour)'],
    ['2,4-DNP', 'Carbonyl compounds (orange precipitate)'],
    ['NaHCO₃', 'Carboxylic acids (effervescence)'],
    ['Bromine water', 'Unsaturation (decolourises)'],
    ['Iodoform test', 'CH₃CO– or CH₃CH(OH)– group'],
  ], (x) => `${x} is used to detect`, (a) => `Which reagent detects ${a.toLowerCase()}?`),
  ...facts('vitamins', 'c-biomolecules', 'Vitamin deficiencies', [
    ['Vitamin A', 'Night blindness'], ['Vitamin B₁', 'Beriberi'], ['Vitamin B₁₂', 'Pernicious anaemia'],
    ['Vitamin C', 'Scurvy'], ['Vitamin D', 'Rickets'], ['Vitamin K', 'Delayed blood clotting'],
  ], (x) => `Deficiency of ${x} causes`, (a) => `${a} is caused by deficiency of`, 'easy'),
];

// ── biology ──────────────────────────────────────────────

const BIOLOGY: Generator[] = [
  {
    id: 'gen-cross', chapterId: 'b-inheritance', concept: 'Mendelian probability', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const c = pick(r, [
        ['Aa × Aa', 'aa', '1/4'], ['Aa × aa', 'aa', '1/2'], ['Aa × Aa', 'Aa', '1/2'], ['AA × aa', 'Aa', '1'],
        ['AaBb × AaBb', 'aabb', '1/16'], ['AaBb × AaBb', 'A_B_ (both dominant traits)', '9/16'], ['AaBb × aabb', 'aabb', '1/4'], ['AaBb × AaBb', 'AaBb', '1/4'],
      ] as const);
      return mcq(r, c[2], ['1/4', '1/2', '3/4', '1/16', '9/16', '3/16', '1/8', '1'], `In the cross ${c[0]} (independent assortment), probability of an offspring with genotype/phenotype ${c[1]} is`, `Work gene by gene and multiply: ${c[1]} = ${c[2]}.`);
    },
  },
  {
    id: 'gametes', chapterId: 'b-inheritance', concept: 'Gamete types', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const loci = ['A', 'B', 'C', 'D', 'E'].slice(0, int(r, 3, 5));
      let het = 0;
      const g = loci.map((L) => {
        const t = L === 'A' ? 1 : int(r, 0, 2);
        if (t === 1) het++;
        return t === 0 ? L + L : t === 1 ? L + L.toLowerCase() : L.toLowerCase() + L.toLowerCase();
      }).join('');
      const n = 2 ** het;
      return num(r, n, [2 * het, het, 2 ** loci.length, n * 2], '', `How many genetically different gametes can ${g} produce (genes unlinked)?`, `${het} heterozygous loci ⇒ 2^${het} = ${n}.`, 0);
    },
  },
  {
    id: 'chargaff', chapterId: 'b-molecular', concept: "Chargaff's rule", kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const a = pick(r, [10, 15, 20, 25, 30, 35, 40]);
      const asks = pick(r, ['cytosine', 'guanine', 'thymine'] as const);
      const ans = asks === 'thymine' ? a : 50 - a;
      return num(r, ans, [100 - a, 50 - a === ans ? a : 50 - a, 100 - 2 * a, a / 2], '%', `A double-stranded DNA has ${a}% adenine. Percentage of ${asks}?`, `A = T = ${a}%; G = C = (100 − ${2 * a})/2 = ${50 - a}%.`, 1);
    },
  },
  {
    id: 'codons', chapterId: 'b-molecular', concept: 'Genetic code', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const aa = pick(r, [50, 100, 120, 200, 333]);
      return num(r, 3 * aa + 3, [3 * aa, aa, 3 * aa + 6, aa + 1], 'nucleotides', `A polypeptide has ${aa} amino acids. Minimum nucleotides in the mRNA from start codon to stop codon (inclusive)?`, `${aa} codons × 3 + 3 for the stop codon = ${3 * aa + 3}.`, 0);
    },
  },
  {
    id: 'hardy', chapterId: 'b-evolution', concept: 'Hardy–Weinberg', kind: 'numeric', difficulty: 'hard',
    make: (r) => {
      const q = pick(r, [0.1, 0.2, 0.3, 0.4, 0.5]);
      const p = 1 - q;
      return num(r, 2 * p * q, [q * q, p * p, p * q, q], '', `In a population at Hardy–Weinberg equilibrium, the frequency of recessive homozygotes (aa) is ${fmt(q * q)}. Frequency of heterozygotes?`, `q = √${fmt(q * q)} = ${q}, p = ${fmt(p)} ⇒ 2pq = ${fmt(2 * p * q)}.`, 3);
    },
  },
  {
    id: 'cardiac', chapterId: 'b-fluids', concept: 'Cardiac cycle', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const hr = pick(r, [60, 75, 80, 100, 120]);
      if (r() < 0.5) return num(r, 60 / hr, [hr / 60, 120 / hr, 30 / hr], 's', `Duration of one cardiac cycle at ${hr} beats per minute?`, `60/${hr} = ${fmt(60 / hr)} s.`, 2);
      const sv = pick(r, [60, 70, 80]);
      return num(r, (sv * hr) / 1000, [sv + hr, (sv * hr) / 100, sv / hr], 'L/min', `Stroke volume ${sv} mL and heart rate ${hr}/min. Cardiac output?`, `CO = SV × HR = ${sv * hr} mL/min = ${fmt((sv * hr) / 1000)} L/min.`);
    },
  },
  {
    id: 'lungvol', chapterId: 'b-breath', concept: 'Lung volumes', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const TV = 500, IRV = pick(r, [2500, 2800, 3000]), ERV = pick(r, [1000, 1100, 1200]), RV = pick(r, [1100, 1200]);
      const which = int(r, 0, 2);
      const [name, val, def] = which === 0 ? ['vital capacity', TV + IRV + ERV, 'TV + IRV + ERV'] : which === 1 ? ['inspiratory capacity', TV + IRV, 'TV + IRV'] : ['functional residual capacity', ERV + RV, 'ERV + RV'];
      return num(r, val, [TV + IRV + ERV + RV, TV + ERV, IRV + ERV, TV + RV].filter((x) => x !== val), 'mL', `TV = ${TV} mL, IRV = ${IRV} mL, ERV = ${ERV} mL, RV = ${RV} mL. The ${name} is`, `${name[0].toUpperCase() + name.slice(1)} = ${def} = ${val} mL.`, 0);
    },
  },
  {
    id: 'meiosis-count', chapterId: 'b-cellcycle', concept: 'Chromosome counts', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const n2 = pick(r, [8, 14, 16, 20, 24, 46]);
      const which = int(r, 0, 2);
      if (which === 0) return num(r, n2 / 2, [n2, n2 * 2, n2 / 4], '', `A cell with 2n = ${n2} undergoes meiosis. Chromosomes in each cell after meiosis I?`, `Meiosis I is reductional: n = ${n2 / 2}.`, 0);
      if (which === 1) return num(r, n2 * 2, [n2, n2 / 2, n2 * 4], '', `A cell with 2n = ${n2}. Number of chromatids at metaphase of mitosis?`, `Each of ${n2} chromosomes has 2 chromatids = ${n2 * 2}.`, 0);
      return num(r, n2, [n2 * 2, n2 / 2, n2 * 4], '', `A cell with 2n = ${n2}. Number of chromosomes at anaphase of meiosis II in each cell?`, `Sister chromatids separate in a haploid cell: ${n2 / 2} × 2 = ${n2}.`, 0);
    },
  },
  {
    id: 'ploidy', chapterId: 'b-plantrepro', concept: 'Ploidy of plant tissues', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const n2 = pick(r, [12, 14, 16, 20, 24]);
      const n = n2 / 2;
      const [part, val] = pick(r, [['endosperm', 3 * n], ['synergid', n], ['embryo', n2], ['nucellus', n2], ['pollen generative cell', n], ['aleurone layer', 3 * n]] as const);
      return num(r, val, [n, n2, 3 * n, 4 * n].filter((x) => x !== val), '', `Leaf cells of an angiosperm have ${n2} chromosomes. Chromosome number in its ${part}?`, `n = ${n}; ${part} is ${val === n ? 'haploid' : val === n2 ? 'diploid' : 'triploid'} = ${val}.`, 0);
    },
  },
  {
    id: 'gameto-count', chapterId: 'b-humanrepro', concept: 'Gametogenesis', kind: 'reasoning', difficulty: 'medium',
    make: (r) => {
      const k = pick(r, [10, 25, 50, 100]);
      const male = r() < 0.5;
      return male
        ? num(r, 4 * k, [k, 2 * k, 8 * k], 'sperms', `${k} primary spermatocytes complete meiosis. Number of sperms formed?`, `Each primary spermatocyte → 4 sperms: ${4 * k}.`, 0)
        : num(r, k, [4 * k, 2 * k, 3 * k], 'ova', `${k} primary oocytes complete meiosis. Number of ova formed?`, `Each primary oocyte → 1 ovum + polar bodies: ${k}.`, 0);
    },
  },
  {
    id: 'ten-pct', chapterId: 'b-ecosystem', concept: '10% law', kind: 'numeric', difficulty: 'medium',
    make: (r) => {
      const E = pick(r, [1000, 10000, 20000, 50000]);
      const lv = pick(r, [['primary consumers', 1], ['secondary consumers', 2], ['tertiary consumers', 3]] as const);
      const v = E * 0.1 ** lv[1];
      return num(r, v, [E * 0.1 ** (lv[1] + 1), E * 0.1 ** Math.max(0, lv[1] - 1), E * 0.9], 'J', `Producers fix ${E} J of energy. By Lindeman's 10% law, energy available to ${lv[0]} is`, `Each step passes ~10%: ${E} × (0.1)^${lv[1]} = ${fmt(v)} J.`, 3);
    },
  },
  ...facts('hormone-src', 'b-chemical', 'Endocrine glands', [
    ['Insulin', 'β-cells of islets of Langerhans'], ['Glucagon', 'α-cells of islets of Langerhans'], ['Melatonin', 'Pineal gland'],
    ['Thymosin', 'Thymus'], ['Parathormone', 'Parathyroid'], ['Cortisol', 'Adrenal cortex (zona fasciculata)'],
    ['Adrenaline', 'Adrenal medulla'], ['Calcitonin', 'Parafollicular (C) cells of thyroid'],
  ], (x) => `${x} is secreted by`, (a) => `Which hormone is secreted by the ${a}?`),
  ...facts('hormone-dis', 'b-chemical', 'Hormonal disorders', [
    ['Diabetes insipidus', 'ADH deficiency'], ['Cretinism', 'Thyroxine deficiency in children'], ['Acromegaly', 'Excess GH in adults'],
    ['Gigantism', 'Excess GH in childhood'], ['Addison’s disease', 'Adrenal cortex hormone deficiency'], ['Graves’ disease', 'Hyperthyroidism'],
  ], (x) => `${x} is caused by`, (a) => `${a} leads to`),
  ...facts('pathogens', 'b-health', 'Pathogens', [
    ['Typhoid', 'Salmonella typhi'], ['Pneumonia', 'Streptococcus pneumoniae'], ['Amoebiasis', 'Entamoeba histolytica'],
    ['Ascariasis', 'Ascaris'], ['Filariasis', 'Wuchereria'], ['Common cold', 'Rhinovirus'], ['Malaria', 'Plasmodium'],
  ], (x) => `${x} is caused by`, (a) => `${a} causes`, 'easy'),
  ...facts('microbes', 'b-microbes', 'Microbial products', [
    ['Penicillin', 'Penicillium notatum'], ['Streptokinase', 'Streptococcus'], ['Cyclosporin A', 'Trichoderma polysporum'],
    ['Statins', 'Monascus purpureus'], ['Citric acid', 'Aspergillus niger'], ['Acetic acid', 'Acetobacter aceti'],
    ['Butyric acid', 'Clostridium butylicum'], ['Swiss cheese (large holes)', 'Propionibacterium sharmanii'],
  ], (x) => `${x} is produced using`, (a) => `${a} is used to produce`),
  ...facts('phyto', 'b-growth', 'Plant hormones', [
    ['Auxin', 'Apical dominance'], ['Gibberellin', 'Bolting in rosette plants'], ['Cytokinin', 'Delays leaf senescence'],
    ['Ethylene', 'Fruit ripening'], ['Abscisic acid', 'Stomatal closure under stress'],
  ], (x) => `A characteristic effect of ${x} is`, (a) => `${a} is mainly caused by`, 'easy'),
  ...facts('organelles', 'b-cell', 'Cell organelles', [
    ['Ribosome', 'Protein synthesis'], ['Lysosome', 'Intracellular digestion'], ['Golgi apparatus', 'Packaging and glycosylation'],
    ['Smooth ER', 'Lipid and steroid synthesis'], ['Nucleolus', 'rRNA synthesis'], ['Centriole', 'Spindle fibres and basal bodies'],
    ['Mitochondrion', 'Aerobic respiration (ATP)'],
  ], (x) => `Main function of the ${x.toLowerCase()} is`, (a) => `Which organelle is responsible for ${a.toLowerCase()}?`, 'easy'),
  ...facts('phyla', 'b-animalk', 'Phylum examples', [
    ['Spongilla', 'Porifera'], ['Physalia', 'Cnidaria'], ['Ctenoplana', 'Ctenophora'], ['Taenia', 'Platyhelminthes'],
    ['Ascaris', 'Aschelminthes'], ['Nereis', 'Annelida'], ['Limulus', 'Arthropoda'], ['Pila', 'Mollusca'],
    ['Asterias', 'Echinodermata'], ['Balanoglossus', 'Hemichordata'],
  ], (x) => `${x} belongs to phylum`, (a) => `Which animal belongs to ${a}?`),
  ...facts('plant-groups', 'b-plantk', 'Plant groups', [
    ['Volvox', 'Chlorophyceae (green algae)'], ['Laminaria', 'Phaeophyceae (brown algae)'], ['Polysiphonia', 'Rhodophyceae (red algae)'],
    ['Sphagnum', 'Bryophyta (moss)'], ['Marchantia', 'Bryophyta (liverwort)'], ['Selaginella', 'Pteridophyta'], ['Cycas', 'Gymnosperms'],
  ], (x) => `${x} belongs to`, (a) => `Which plant belongs to ${a}?`),
  ...facts('biotech-tools', 'b-biotech-principles', 'Tools of rDNA technology', [
    ['DNA ligase', 'Joins DNA fragments'], ['Taq polymerase', 'Heat-stable DNA synthesis in PCR'], ['Lysozyme', 'Breaks bacterial cell wall'],
    ['Chitinase', 'Breaks fungal cell wall'], ['Ethidium bromide', 'Stains DNA (orange under UV)'], ['Restriction endonuclease', 'Cuts DNA at specific palindromes'],
  ], (x) => `Role of ${x} in genetic engineering?`, (a) => `Which is used for this: ${a.toLowerCase()}?`),
  ...facts('interactions', 'b-organisms', 'Population interactions', [
    ['Lichen (alga + fungus)', 'Mutualism'], ['Orchid growing on a mango branch', 'Commensalism'], ['Cuscuta on hedge plants', 'Parasitism'],
    ['Penicillium inhibiting bacteria', 'Amensalism'], ['Tiger eating deer', 'Predation'],
  ], (x) => `${x} is an example of`, (a) => `Which is an example of ${a.toLowerCase()}?`, 'easy'),
];

export const GENERATORS: Generator[] = [...PHYSICS, ...CHEMISTRY, ...BIOLOGY];
const BY_ID = new Map(GENERATORS.map((g) => [g.id, g]));

export const generatorsFor = (chapterId: string) => GENERATORS.filter((g) => g.chapterId === chapterId);

export const isGenerated = (id: string) => id.startsWith('gen:');

/** Learned-difficulty key: all variants of one generator share a rating. */
export const ratingKey = (id: string) => (isGenerated(id) ? id.slice(0, id.lastIndexOf(':')) : id);

export const generatorOf = (id: string) => (isGenerated(id) ? BY_ID.get(id.split(':')[1]) : undefined);

const cache = new Map<string, Question>();

export function buildGenerated(g: Generator, seed: number): Question {
  const id = `gen:${g.id}:${seed >>> 0}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const b = g.make(rng(seed >>> 0));
  const q: Question = { id, chapterId: g.chapterId, difficulty: g.difficulty, concept: g.concept, generated: true, ...b };
  if (cache.size > 5000) cache.clear();
  cache.set(id, q);
  return q;
}

/** Rebuilds a generated question from its id, or undefined for unknown ids. */
export function resolveGenerated(id: string): Question | undefined {
  const g = generatorOf(id);
  if (!g) return undefined;
  const seed = Number(id.slice(id.lastIndexOf(':') + 1));
  return Number.isFinite(seed) ? buildGenerated(g, seed) : undefined;
}

/** A fresh variant of the same concept, used to re-test a mistake with new numbers. */
export function sibling(id: string, seed: number): Question | undefined {
  const g = generatorOf(id);
  return g ? buildGenerated(g, seed) : undefined;
}
