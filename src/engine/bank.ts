import { BUILTIN_QUESTIONS } from '../data/questions';
import { CHAPTER_BY_ID } from '../data/syllabus';
import type { AppState, Question } from '../types';
import { resolveGenerated } from './generators';

/** Questions from the shared cloud bank (set after sign-in; empty in offline mode). */
let shared: Question[] = [];
export function setSharedQuestions(list: Question[]) {
  shared = list.map((q) => ({ ...q, shared: true }));
}
export const sharedQuestions = () => shared;

/** Fixed questions: built-in + shared cloud bank + her own. Generated variants are produced on demand. */
export function allQuestions(state: Pick<AppState, 'customQuestions'>): Question[] {
  return [...BUILTIN_QUESTIONS, ...shared, ...state.customQuestions];
}

/** id → question lookup. Generated ids (gen:…) are rebuilt on access. */
export function questionMap(state: Pick<AppState, 'customQuestions'>): Record<string, Question> {
  const base: Record<string, Question> = Object.fromEntries(allQuestions(state).map((q) => [q.id, q]));
  return new Proxy(base, {
    get(target, key) {
      if (typeof key !== 'string') return undefined;
      return target[key] ?? resolveGenerated(key);
    },
  });
}

export function questionsByChapter(state: Pick<AppState, 'customQuestions'>): Record<string, Question[]> {
  const out: Record<string, Question[]> = {};
  for (const q of allQuestions(state)) (out[q.chapterId] ??= []).push(q);
  return out;
}

export function subjectOf(q: Question) {
  return CHAPTER_BY_ID[q.chapterId]?.subject ?? 'Biology';
}

/** Validates an untrusted object as a question; returns an error string or null. */
export function validateQuestion(q: unknown): string | null {
  if (!q || typeof q !== 'object') return 'not an object';
  const o = q as Record<string, unknown>;
  if (typeof o.chapterId !== 'string' || !CHAPTER_BY_ID[o.chapterId]) return `unknown chapterId "${String(o.chapterId)}"`;
  if (typeof o.text !== 'string' || !o.text.trim()) return 'missing text';
  if (!Array.isArray(o.options) || o.options.length !== 4 || o.options.some((x) => typeof x !== 'string' || !x.trim()))
    return 'options must be 4 non-empty strings';
  if (typeof o.answer !== 'number' || !Number.isInteger(o.answer) || o.answer < 0 || o.answer > 3) return 'answer must be 0–3';
  if (o.difficulty !== undefined && !['easy', 'medium', 'hard'].includes(o.difficulty as string))
    return 'difficulty must be easy | medium | hard';
  return null;
}
