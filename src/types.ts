export type Subject = 'Physics' | 'Chemistry' | 'Biology';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type MistakeType = 'concept' | 'memory' | 'calculation' | 'misread' | 'guess' | 'time';
export type Mode = 'practice' | 'daily' | 'weekly' | 'review' | 'custom';

export interface Chapter {
  id: string;
  subject: Subject;
  unit: string;
  name: string;
  classLevel: 11 | 12;
  /** Approximate average number of NEET questions per year from this chapter. */
  weight: number;
  keywords: string[];
}

export interface Question {
  id: string;
  chapterId: string;
  difficulty: Difficulty;
  concept: string;
  text: string;
  options: string[];
  answer: number;
  explanation: string;
  custom?: boolean;
  /** Created by a question generator (id = gen:<generator>:<seed>). */
  generated?: boolean;
  /** Came from the shared cloud question bank. */
  shared?: boolean;
}

export interface Attempt {
  qid: string;
  chapterId: string;
  /** null = skipped */
  correct: boolean | null;
  timeSec: number;
  at: number;
  mode: Mode;
  mistake?: MistakeType;
}

export interface TopicStat {
  chapterId: string;
  /** Elo-style ability rating for this chapter. */
  rating: number;
  attempts: number;
  correct: number;
  lastAt: number;
  /** Memory stability in days (grows with successful spaced practice). */
  stability: number;
  mistakes: Record<MistakeType, number>;
  /** Last results, newest last: 1 correct, 0 wrong. */
  recent: number[];
  avgTimeRatio: number;
}

export interface MistakeCard {
  qid: string;
  chapterId: string;
  addedAt: number;
  due: number;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
  lastType?: MistakeType;
}

export interface SubjectScore {
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  max: number;
}

export interface TestResult {
  id: string;
  kind: 'daily' | 'weekly' | 'custom';
  startedAt: number;
  durationSec: number;
  questionIds: string[];
  answers: (number | null)[];
  times: number[];
  score: number;
  maxScore: number;
  correct: number;
  wrong: number;
  skipped: number;
  bySubject: Record<Subject, SubjectScore>;
}

export interface Profile {
  name: string;
  examDate: string; // yyyy-mm-dd
  targetRank: number;
  dailyGoal: number;
  onboarded: boolean;
  createdAt: number;
}

export interface PathSnapshot {
  at: number;
  targetMarks: number;
  predictedMarks: number;
  focus: string[];
  changes: string[];
}

export interface AppState {
  version: number;
  /** Last local modification (ms). Used to resolve sync between devices. */
  updatedAt: number;
  profile: Profile;
  stats: Record<string, TopicStat>;
  attempts: Attempt[];
  tests: TestResult[];
  mistakes: Record<string, MistakeCard>;
  customQuestions: Question[];
  /** Learned difficulty rating of each question. */
  qRatings: Record<string, number>;
  pathHistory: PathSnapshot[];
  /** date key -> completed task ids */
  tasksDone: Record<string, string[]>;
  bookmarks: string[];
  theme: 'light' | 'dark' | 'system';
}
