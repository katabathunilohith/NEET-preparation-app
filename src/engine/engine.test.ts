import { describe, expect, it } from 'vitest';
import { BUILTIN_QUESTIONS } from '../data/questions';
import { CHAPTERS, CHAPTER_BY_ID, chapterShare } from '../data/syllabus';
import { questionMap, validateQuestion } from './bank';
import { DAY, mastery } from './mastery';
import { buildPath } from './path';
import { marksForRank, predictedMarks, rankForMarks } from './predict';
import { searchChapters, searchQuestions } from './search';
import { defaultState, recordAnswer, setAttemptMistake, streak, submitTest } from './state';
import { dailyTest, weeklyTest } from './testgen';

const NOW = new Date('2026-10-15T10:00:00').getTime();
const fresh = () => ({ ...defaultState(NOW), profile: { ...defaultState(NOW).profile, onboarded: true } });

describe('question bank', () => {
  it('every question is valid and belongs to a chapter', () => {
    for (const q of BUILTIN_QUESTIONS) {
      expect(validateQuestion(q), q.id).toBeNull();
      expect(CHAPTER_BY_ID[q.chapterId]).toBeDefined();
    }
  });
  it('every chapter has at least two questions and ids are unique', () => {
    for (const c of CHAPTERS) expect(BUILTIN_QUESTIONS.filter((q) => q.chapterId === c.id).length, c.id).toBeGreaterThanOrEqual(2);
    expect(new Set(BUILTIN_QUESTIONS.map((q) => q.id)).size).toBe(BUILTIN_QUESTIONS.length);
  });
  it('chapter shares sum to 1', () => {
    expect(CHAPTERS.reduce((s, c) => s + chapterShare(c), 0)).toBeCloseTo(1, 6);
  });
});

describe('learning', () => {
  it('correct answers raise mastery, wrong answers lower it', () => {
    const q = BUILTIN_QUESTIONS.find((x) => x.chapterId === 'p-rot')!;
    let s = fresh();
    const before = mastery(s.stats['p-rot'], NOW);
    for (let i = 0; i < 5; i++) s = recordAnswer(s, q, q.answer, 40, 'practice', NOW + i);
    const up = mastery(s.stats['p-rot'], NOW);
    expect(up).toBeGreaterThan(before);
    for (let i = 0; i < 5; i++) s = recordAnswer(s, q, (q.answer + 1) % 4, 40, 'practice', NOW + 10 + i);
    expect(mastery(s.stats['p-rot'], NOW)).toBeLessThan(up);
    expect(s.mistakes[q.id]).toBeDefined();
  });

  it('mastery fades without revision', () => {
    const q = BUILTIN_QUESTIONS.find((x) => x.chapterId === 'b-cell')!;
    let s = fresh();
    for (let i = 0; i < 8; i++) s = recordAnswer(s, q, q.answer, 20, 'practice', NOW);
    expect(mastery(s.stats['b-cell'], NOW + 60 * DAY)).toBeLessThan(mastery(s.stats['b-cell'], NOW));
  });

  it('corrected mistake type is learned', () => {
    const q = BUILTIN_QUESTIONS.find((x) => x.chapterId === 'c-equil')!;
    let s = recordAnswer(fresh(), q, (q.answer + 1) % 4, 30, 'practice', NOW);
    const auto = s.attempts[0].mistake!;
    s = setAttemptMistake(s, q.id, NOW, auto === 'guess' ? 'concept' : 'guess');
    expect(s.stats['c-equil'].mistakes[auto]).toBe(0);
  });

  it('path focuses on chapters with repeated mistakes and explains the change', () => {
    let s = fresh();
    const qs = BUILTIN_QUESTIONS.filter((x) => x.chapterId === 'b-molecular');
    for (let r = 0; r < 3; r++) for (const q of qs) s = recordAnswer(s, q, (q.answer + 1) % 4, 30, 'practice', NOW);
    const path = buildPath(s, NOW);
    const idx = path.chapters.findIndex((c) => c.chapter.id === 'b-molecular');
    expect(idx).toBeLessThan(5);
    expect(path.chapters[idx].reasons.join(' ')).toMatch(/wrong/);
    expect(path.today.length).toBeGreaterThan(0);
  });
});

describe('prediction', () => {
  it('rank and marks curves are monotone and inverse-ish', () => {
    expect(rankForMarks(700)).toBeLessThan(rankForMarks(600));
    expect(marksForRank(1000)).toBeGreaterThan(marksForRank(50000));
    expect(Math.abs(marksForRank(rankForMarks(620)) - 620)).toBeLessThanOrEqual(2);
  });
  it('predicted marks rise as she improves', () => {
    let s = fresh();
    const base = predictedMarks(s, NOW);
    for (const q of BUILTIN_QUESTIONS) s = recordAnswer(s, q, q.answer, 20, 'practice', NOW);
    expect(predictedMarks(s, NOW)).toBeGreaterThan(base);
  });
});

describe('tests', () => {
  it('weekly test follows NEET subject ratio and scores +4/−1', () => {
    const s = fresh();
    const spec = weeklyTest(s, NOW);
    const qm = questionMap(s);
    const subj = spec.questionIds.map((id) => CHAPTER_BY_ID[qm[id].chapterId].subject);
    expect(subj.filter((x) => x === 'Biology').length).toBeGreaterThan(subj.filter((x) => x === 'Physics').length);
    const answers = spec.questionIds.map((id, i) => (i === 0 ? null : i % 2 ? qm[id].answer : (qm[id].answer + 1) % 4));
    const { result, state } = submitTest(s, spec, answers, answers.map(() => 30), NOW, NOW);
    expect(result.score).toBe(result.correct * 4 - result.wrong);
    expect(result.skipped).toBe(1);
    expect(state.tests).toHaveLength(1);
    expect(state.pathHistory.length).toBeGreaterThan(0);
  });
  it('daily test has 15 unique questions', () => {
    const s = fresh();
    const spec = dailyTest(s, buildPath(s, NOW), NOW);
    expect(spec.questionIds).toHaveLength(15);
    expect(new Set(spec.questionIds).size).toBe(15);
  });
});

describe('search & streak', () => {
  it('finds chapters by keyword and questions by text', () => {
    expect(searchChapters('projectile')[0].id).toBe('p-kinematics');
    expect(searchChapters('mitosis')[0].id).toBe('b-cellcycle');
    expect(searchQuestions(fresh(), 'Okazaki').length).toBeGreaterThan(0);
  });
  it('counts consecutive study days', () => {
    const q = BUILTIN_QUESTIONS[0];
    let s = fresh();
    for (let d = 0; d < 3; d++) s = recordAnswer(s, q, q.answer, 20, 'practice', NOW - d * DAY);
    expect(streak(s, NOW)).toBe(3);
  });
});
