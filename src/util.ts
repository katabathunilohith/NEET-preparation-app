import type { Subject } from './types';

export const SUBJECT_COLOR: Record<Subject, string> = {
  Physics: 'var(--physics)',
  Chemistry: 'var(--chemistry)',
  Biology: 'var(--biology)',
};

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function fmtTime(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(t: number, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(t).toLocaleDateString(undefined, opts);
}

export function fmtRank(r: number) {
  return r.toLocaleString('en-IN');
}

export function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
