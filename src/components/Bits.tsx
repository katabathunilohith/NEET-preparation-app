import type { ReactNode } from 'react';
import { MISTAKE_LABEL, MISTAKE_TYPES, type Level } from '../engine/mastery';
import type { MistakeType, Subject } from '../types';
import { SUBJECT_COLOR, pct } from '../util';

export function MasteryBar({ value, target, color }: { value: number; target?: number; color?: string }) {
  return (
    <div className="bar" role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Mastery ${pct(value)}`}>
      <span style={{ width: pct(value), background: color }} />
      {target !== undefined && <i className="target" style={{ left: pct(target) }} title={`Target ${pct(target)}`} />}
    </div>
  );
}

const LEVEL_TAG: Record<Level, [string, string]> = {
  new: ['', 'Not assessed'],
  weak: ['bad', 'Weak'],
  developing: ['warn', 'Developing'],
  strong: ['good', 'Strong'],
};
export function LevelBadge({ level }: { level: Level }) {
  const [cls, label] = LEVEL_TAG[level];
  return <span className={`tag ${cls}`}>{label}</span>;
}

export function SubjectDot({ subject }: { subject: Subject }) {
  return <span className="dot" style={{ background: SUBJECT_COLOR[subject] }} aria-hidden />;
}

export function MistakePicker({ value, onChange }: { value?: MistakeType; onChange: (t: MistakeType) => void }) {
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 6 }}>Why was this wrong? Correcting the guess helps the planner.</div>
      <div className="chips">
        {MISTAKE_TYPES.map((t) => (
          <button key={t} type="button" className={`chip${value === t ? ' on' : ''}`} onClick={() => onChange(t)} aria-pressed={value === t}>
            {MISTAKE_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Figure({ label, value, unit, sub }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="figure">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, l]) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)} aria-pressed={value === k}>{l}</button>
      ))}
    </div>
  );
}
