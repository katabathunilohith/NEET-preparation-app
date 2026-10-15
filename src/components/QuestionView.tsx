import { CHAPTER_BY_ID } from '../data/syllabus';
import type { Question } from '../types';
import { SubjectDot } from './Bits';

const KEYS = ['A', 'B', 'C', 'D'];

interface Props {
  q: Question;
  index?: number;
  selected: number | null;
  /** When true, shows correct/wrong colouring and the explanation. */
  reveal: boolean;
  onSelect?: (i: number) => void;
  bookmarked?: boolean;
  onBookmark?: () => void;
}

export function QuestionView({ q, index, selected, reveal, onSelect, bookmarked, onBookmark }: Props) {
  const ch = CHAPTER_BY_ID[q.chapterId];
  return (
    <div>
      <div className="q-meta">
        <span className="row" style={{ gap: 8 }}>
          <SubjectDot subject={ch.subject} />
          {index !== undefined && <strong style={{ color: 'var(--ink)' }}>Q{index + 1}</strong>}
          <span>{ch.name} — {q.concept}</span>
        </span>
        <span className="row" style={{ gap: 12 }}>
          {q.generated && <span title="Generated for you from your weak spots">Generated</span>}
          {q.shared && <span>Shared bank</span>}
          <span style={{ textTransform: 'capitalize' }}>{q.difficulty}</span>
          {onBookmark && (
            <button className="link-btn small" onClick={onBookmark} aria-pressed={bookmarked}>{bookmarked ? 'Bookmarked' : 'Bookmark'}</button>
          )}
        </span>
      </div>
      <div className="q-text">{q.text}</div>
      <div className="options">
        {q.options.map((opt, i) => {
          let cls = 'option';
          if (reveal) {
            if (i === q.answer) cls += ' correct';
            else if (i === selected) cls += ' wrong';
          } else if (i === selected) cls += ' selected';
          return (
            <button key={i} className={cls} disabled={reveal || !onSelect} onClick={() => onSelect?.(i)}>
              <span className="key">{KEYS[i]}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {reveal && (
        <div className={`callout ${selected === q.answer ? 'good' : selected === null ? '' : 'bad'}`} style={{ marginTop: 14 }}>
          <strong>{selected === q.answer ? 'Correct  +4' : selected === null ? `Not answered — correct option ${KEYS[q.answer]}` : `Incorrect  −1 — correct option ${KEYS[q.answer]}`}</strong>
          {q.explanation}
        </div>
      )}
    </div>
  );
}
