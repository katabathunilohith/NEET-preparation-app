import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LevelBadge, SubjectDot } from '../components/Bits';
import { QuestionView } from '../components/QuestionView';
import { CHAPTER_BY_ID } from '../data/syllabus';
import { levelOf, mastery } from '../engine/mastery';
import { searchChapters, searchQuestions } from '../engine/search';
import { useStore } from '../store/store';
import { pct } from '../util';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const now = Date.now();
  const chapters = searchChapters(q);
  const questions = searchQuestions(state, q);

  return (
    <>
      <div className="page-head" style={{ display: 'block' }}>
        <div className="eyebrow">Search</div>
        <input type="search" autoFocus value={q} onChange={(e) => setParams({ q: e.target.value }, { replace: true })} placeholder="Try enzyme, Carnot, SN2, class 12 biology" aria-label="Search query" style={{ fontSize: '1.1rem', padding: '10px 12px', maxWidth: 560 }} />
      </div>
      {!q.trim() && <div className="empty">Searches chapter names, keywords, concepts and question text.</div>}
      {q.trim() && (
        <>
          <section>
            <div className="section-head"><h2>Chapters</h2><span className="tiny faint">{chapters.length}</span></div>
            {chapters.length === 0 ? <p className="small faint">No chapters match.</p> : (
              <table>
                <tbody>
                  {chapters.slice(0, 10).map((c) => (
                    <tr key={c.id}>
                      <td><span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><SubjectDot subject={c.subject} /><Link to={`/topics/${c.id}`}>{c.name}</Link></span><div className="tiny faint" style={{ marginLeft: 16 }}>{c.subject} · {c.unit}</div></td>
                      <td><LevelBadge level={levelOf(state.stats[c.id], now)} /></td>
                      <td className="r num">{pct(mastery(state.stats[c.id], now))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="section">
            <div className="section-head"><h2>Questions</h2><span className="tiny faint">{questions.length}{questions.length === 40 ? '+' : ''}</span></div>
            {questions.length === 0 && <p className="small faint">No questions match.</p>}
            <div className="list">
              {questions.map((x) => (
                <div key={x.id} className="list-item" style={{ display: 'block' }}>
                  <button className="link-btn" style={{ textDecoration: 'none', color: 'var(--ink)', width: '100%' }} onClick={() => setOpen(open === x.id ? null : x.id)} aria-expanded={open === x.id}>
                    <span className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'baseline' }}><SubjectDot subject={CHAPTER_BY_ID[x.chapterId].subject} /><span>{x.text}</span></span>
                    <span className="tiny faint" style={{ marginLeft: 16, display: 'block' }}>{CHAPTER_BY_ID[x.chapterId].name} · {x.concept}</span>
                  </button>
                  {open === x.id && <div style={{ marginTop: 12 }}><QuestionView q={x} selected={null} reveal /></div>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
