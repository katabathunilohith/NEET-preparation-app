import type { AppState, Question } from '../types';
import { supabase } from './client';

export type Role = 'student' | 'guardian';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
}

export interface StudentSummary {
  id: string;
  name: string;
  email: string | null;
  state: AppState | null;
  updatedAt: string | null;
}

function db() {
  if (!supabase) throw new Error('Cloud sync is not configured');
  return supabase;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from('profiles').select('id, email, display_name, role').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function setRole(userId: string, role: Role) {
  const { error } = await db().from('profiles').update({ role }).eq('id', userId);
  if (error) throw error;
}

export async function fetchState(userId: string): Promise<AppState | null> {
  const { data, error } = await db().from('user_state').select('state').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.state as AppState | undefined) ?? null;
}

export async function saveState(userId: string, state: AppState) {
  const { error } = await db().from('user_state').upsert({ user_id: userId, state, updated_at: new Date(state.updatedAt || Date.now()).toISOString() });
  if (error) throw error;
}

interface QuestionRow {
  id: string;
  chapter_id: string;
  difficulty: Question['difficulty'];
  concept: string;
  text: string;
  options: string[];
  answer: number;
  explanation: string;
}

export async function fetchSharedQuestions(): Promise<Question[]> {
  const { data, error } = await db().from('questions').select('id, chapter_id, difficulty, concept, text, options, answer, explanation').limit(5000);
  if (error) throw error;
  return (data as QuestionRow[]).map((r) => ({
    id: `shared-${r.id}`,
    chapterId: r.chapter_id,
    difficulty: r.difficulty,
    concept: r.concept,
    text: r.text,
    options: r.options,
    answer: r.answer,
    explanation: r.explanation,
    shared: true,
  }));
}

export async function publishQuestions(userId: string, qs: Omit<Question, 'id'>[]) {
  const rows = qs.map((q) => ({
    chapter_id: q.chapterId,
    difficulty: q.difficulty,
    concept: q.concept,
    text: q.text,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    created_by: userId,
  }));
  const { error } = await db().from('questions').insert(rows);
  if (error) throw error;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await db().from('admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function listGuardians(userId: string): Promise<string[]> {
  const { data, error } = await db().from('guardians').select('guardian_email').eq('student_id', userId).order('created_at');
  if (error) throw error;
  return (data ?? []).map((r) => r.guardian_email as string);
}

export async function addGuardian(userId: string, email: string) {
  const { error } = await db().from('guardians').insert({ student_id: userId, guardian_email: email.trim().toLowerCase() });
  if (error) throw error;
}

export async function removeGuardian(userId: string, email: string) {
  const { error } = await db().from('guardians').delete().eq('student_id', userId).eq('guardian_email', email);
  if (error) throw error;
}

/** Students who have added the signed-in user's email as a guardian. */
export async function listStudents(email: string): Promise<StudentSummary[]> {
  const { data: links, error } = await db().from('guardians').select('student_id').ilike('guardian_email', email);
  if (error) throw error;
  const ids = [...new Set((links ?? []).map((l) => l.student_id as string))];
  if (!ids.length) return [];
  const [{ data: profiles }, { data: states }] = await Promise.all([
    db().from('profiles').select('id, email, display_name').in('id', ids),
    db().from('user_state').select('user_id, state, updated_at').in('user_id', ids),
  ]);
  return ids.map((id) => {
    const p = profiles?.find((x) => x.id === id);
    const s = states?.find((x) => x.user_id === id);
    const st = (s?.state as AppState | undefined) ?? null;
    return { id, name: st?.profile.name || p?.display_name || p?.email || 'Student', email: p?.email ?? null, state: st, updatedAt: s?.updated_at ?? null };
  });
}
