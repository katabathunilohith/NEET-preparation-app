import { describe, expect, it } from 'vitest';
import { CHAPTER_BY_ID } from '../data/syllabus';
import { validateQuestion, questionMap } from './bank';
import { GENERATORS, buildGenerated, resolveGenerated, ratingKey } from './generators';
import { buildPath } from './path';
import { defaultState, recordAnswer } from './state';
import { dailyTest, practiceSet } from './testgen';

const NOW = new Date('2026-10-15T10:00:00').getTime();

describe('generators', () => {
  it('every generator yields valid, unambiguous questions across many seeds', () => {
    for (const g of GENERATORS) {
      expect(CHAPTER_BY_ID[g.chapterId], g.id).toBeDefined();
      for (let seed = 1; seed < 300; seed += 7) {
        const q = buildGenerated(g, seed);
        expect(validateQuestion(q), `${g.id}:${seed}`).toBeNull();
        expect(new Set(q.options).size, `${g.id}:${seed} duplicate options ${q.options}`).toBe(4);
        expect(q.options.some((o) => /NaN|undefined|Infinity/.test(o)), `${g.id}:${seed} ${q.options}`).toBe(false);
      }
    }
  });

  it('ids round-trip and share a rating key', () => {
    const q = buildGenerated(GENERATORS[0], 12345);
    expect(resolveGenerated(q.id)).toEqual(q);
    expect(questionMap({ customQuestions: [] })[q.id]?.text).toBe(q.text);
    expect(ratingKey(q.id)).toBe(`gen:${GENERATORS[0].id}`);
  });

  it('calculation mistakes steer practice toward numerical variants', () => {
    let s = { ...defaultState(NOW), profile: { ...defaultState(NOW).profile, onboarded: true } };
    const g = GENERATORS.find((x) => x.chapterId === 'p-current' && x.kind === 'numeric')!;
    for (let i = 0; i < 4; i++) {
      const q = buildGenerated(g, i + 1);
      s = recordAnswer(s, q, (q.answer + 1) % 4, 60, 'practice', NOW, 'calculation');
    }
    const share = (st: typeof s) => {
      const ids = Array.from({ length: 40 }, (_, i) => practiceSet(st, 'p-current', 5, NOW, i + 1)).flat();
      return ids.filter((id) => id.startsWith('gen:cur-terminal') || id.startsWith('gen:cur-parallel')).length / ids.length;
    };
    const baseline = { ...s, stats: {}, attempts: [] };
    expect(share(s)).toBeGreaterThan(share(baseline) * 1.3);
  });

  it('due mistakes on generated questions return as a fresh variant', () => {
    let s = { ...defaultState(NOW), profile: { ...defaultState(NOW).profile, onboarded: true } };
    const q = buildGenerated(GENERATORS.find((x) => x.id === 'chargaff')!, 7);
    s = recordAnswer(s, q, (q.answer + 1) % 4, 30, 'practice', NOW - 2 * 86_400_000);
    const spec = dailyTest(s, buildPath(s, NOW), NOW);
    const variant = spec.questionIds.find((id) => id.startsWith('gen:chargaff:'));
    expect(variant).toBeDefined();
    expect(variant).not.toBe(q.id);
  });
});
