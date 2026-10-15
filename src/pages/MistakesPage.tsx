import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Seg, SubjectDot } from '../components/Bits';
import { PracticeSession } from '../components/PracticeSession';
import { QuestionView } from '../components/QuestionView';
import { CHAPTER_BY_ID, SUBJECTS } from '../data/syllabus';
import { questionMap } from '../engine/bank';
import { MISTAKE_LABEL } from '../engine/mastery';
import { GRADUATE_DAYS, dueCards } from '../engine/srs';
import { useStore } from '../store/store';
import type { Subject } from '../types';
import { fmtDate } from '../util';

export function MistakesPage() {
  const { state, readOnly } = useStore();
  const [reviewIds, setReviewIds] = useState<string[] | null>(null);
  const [tab, setTab] = useState<'notebook' | 'bookmarks'>('notebook');
  const [subject, setSubject] = useState<Subject | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const now = Date.now();
  const qmap = questionMap(state);
  const due = dueCards(state, now).filter((c) => qmap[c.qid]);

  if (reviewIds) return <PracticeSession ids={reviewIds} mode="review" title="Mistake review" backTo="/mistakes" />;

  const cards = Object.values(state.mistakes)
    .filter((c) => qmap[c.qid] && (subject === 'all' || CHAPTER_BY_ID[c.chapterId]?.subject === subject))
    .sort((a, b) => a.due - b.due);
  const bookmarks = state.bookmarks.filter((id) => qmap[id] && (subject === 'all' || CHAPTER_BY_ID[qmap[id].chapterId].subject === subject));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Mistakes</div>
          <h1>Mistake notebook</h1>
          <p className="muted">Every wrong answer comes back after 1 day, then 3, then at growing gaps. Once the gap reaches {GRADUATE_DAYS} days it is considered fixed.</p>
        </div>
        {!readOnly && (
          <button className="btn primary" disabled={!due.length} onClick={() => setReviewIds(due.slice(0, 20).map((c) => c.qid))}>
            {due.length ? `Review ${Math.min(20, due.length)} due` : 'Nothing due'}
          </button>
        )}
      </div>
      <div className="row between">
        <Seg label="List" value={tab} onChange={setTab} options={[['notebook', `Mistakes (${Object.keys(state.mistakes).length})`], ['bookmarks', `Bookmarks (${state.bookmarks.length})`]]} />
        <Seg label="Subject" value={subject} onChange={setSubject} options={[['all', 'All'], ...SUBJECTS.map((s) => [s, s] as const)]} />
      </div>

      {tab === 'notebook' && (
        <section className="section">
          {cards.length === 0 && <div className="empty">No mistakes saved{subject !== 'all' ? ` in ${subject}` : ''}. Wrong answers are added automatically.</div>}
          {cards.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Question</th><th>Reason</th><th className="r">Times wrong</th><th className="r">Next review</th></tr></thead>
                <tbody>
                  {cards.map((c) => {
                    const q = qmap[c.qid];
                    const isDue = c.due <= now;
                    return [
                      <tr key={c.qid} onClick={() => setOpen(open === c.qid ? null : c.qid)} style={{ cursor: 'pointer' }}>
                        <td style={{ maxWidth: 420 }}>
                          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><SubjectDot subject={CHAPTER_BY_ID[c.chapterId].subject} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.text}</span></div>
                          <div className="tiny faint" style={{ marginLeft: 16 }}>{CHAPTER_BY_ID[c.chapterId].name}{q.generated ? ' · generated' : ''}</div>
                        </td>
                        <td className="small">{c.lastType ? MISTAKE_LABEL[c.lastType] : '–'}</td>
                        <td className="r num">{c.lapses}</td>
                        <td className="r nowrap">{isDue ? <span className="tag bad">Due</span> : <span className="small muted">{fmtDate(c.due)}</span>}</td>
                      </tr>,
                      open === c.qid && (
                        <tr key={`${c.qid}-open`}><td colSpan={4} style={{ padding: '12px 0 20px' }}><QuestionView q={q} selected={null} reveal /></td></tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'bookmarks' && (
        <section className="section stack">
          {bookmarks.length === 0 && <div className="empty">Use “Bookmark” on any question during practice to keep it here.</div>}
          {bookmarks.length > 0 && !readOnly && <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setReviewIds(bookmarks.slice(0, 30))}>Practise bookmarked questions</button>}
          {bookmarks.map((id) => <div key={id} className="card"><QuestionView q={qmap[id]} selected={null} reveal /></div>)}
        </section>
      )}
      {!readOnly && <p className="small faint" style={{ marginTop: 16 }}>Wrong answers in tests are added too. <Link to="/tests">Go to tests</Link></p>}
    </>
  );
}
