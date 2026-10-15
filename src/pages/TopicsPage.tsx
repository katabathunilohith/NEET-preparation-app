import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LevelBadge, MasteryBar, Seg, SubjectDot } from '../components/Bits';
import { CHAPTERS, SUBJECTS, unitsOf } from '../data/syllabus';
import { questionsByChapter } from '../engine/bank';
import { generatorsFor } from '../engine/generators';
import { levelOf, type Level } from '../engine/mastery';
import { searchChapters } from '../engine/search';
import { useStore } from '../store/store';
import type { Chapter, Subject } from '../types';
import { SUBJECT_COLOR, pct } from '../util';

type Group = 'unit' | 'level' | 'class' | 'weight';
const LEVEL_ORDER: Level[] = ['weak', 'developing', 'new', 'strong'];
const LEVEL_TITLE: Record<Level, string> = { weak: 'Weak', developing: 'Developing', new: 'Not assessed yet', strong: 'Strong' };

export function TopicsPage() {
  const { state, path } = useStore();
  const [params, setParams] = useSearchParams();
  const subject = (params.get('subject') as Subject | 'all' | null) ?? 'all';
  const group = (params.get('group') as Group | null) ?? 'unit';
  const [query, setQuery] = useState('');
  const now = Date.now();
  const byChapter = useMemo(() => questionsByChapter(state), [state]);
  const plan = Object.fromEntries(path.chapters.map((c) => [c.chapter.id, c]));

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  };

  let chapters = query.trim() ? searchChapters(query) : CHAPTERS;
  if (subject !== 'all') chapters = chapters.filter((c) => c.subject === subject);

  const groups: { title: string; items: Chapter[] }[] = [];
  if (group === 'unit') {
    for (const s of SUBJECTS) for (const u of unitsOf(s)) {
      const items = chapters.filter((c) => c.subject === s && c.unit === u);
      if (items.length) groups.push({ title: `${s} — ${u}`, items });
    }
  } else if (group === 'level') {
    for (const l of LEVEL_ORDER) {
      const items = chapters.filter((c) => levelOf(state.stats[c.id], now) === l);
      if (items.length) groups.push({ title: LEVEL_TITLE[l], items });
    }
  } else if (group === 'class') {
    for (const cl of [11, 12]) {
      const items = chapters.filter((c) => c.classLevel === cl);
      if (items.length) groups.push({ title: `Class ${cl}`, items });
    }
  } else {
    const hi = chapters.filter((c) => c.weight >= 3), mid = chapters.filter((c) => c.weight === 2), lo = chapters.filter((c) => c.weight <= 1);
    if (hi.length) groups.push({ title: 'High weightage — 3 or more questions a year', items: hi });
    if (mid.length) groups.push({ title: 'Medium weightage — about 2 a year', items: mid });
    if (lo.length) groups.push({ title: 'Low weightage — about 1 a year', items: lo });
  }

  return (
    <>
      <div className="page-head">
        <div><div className="eyebrow">Practice</div><h1>Chapters</h1><p className="muted">{CHAPTERS.length} NEET chapters. Pick one to practise, or let the study path choose.</p></div>
      </div>
      <div className="row between" style={{ gap: 12 }}>
        <input type="search" placeholder="Filter chapters — e.g. genetics, lens, pH" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter chapters" style={{ maxWidth: 320 }} />
        <div className="row">
          <Seg label="Subject" value={subject} onChange={(v) => set('subject', v)} options={[['all', 'All'], ...SUBJECTS.map((s) => [s, s] as const)]} />
          <Seg label="Group by" value={group} onChange={(v) => set('group', v)} options={[['unit', 'Unit'], ['level', 'Level'], ['weight', 'Weightage'], ['class', 'Class']]} />
        </div>
      </div>

      {groups.length === 0 && <div className="empty">No chapters match “{query}”. The search in the top bar also looks inside questions.</div>}
      {groups.map((g) => (
        <section key={g.title} className="section">
          <div className="section-head"><h2>{g.title}</h2><span className="tiny faint">{g.items.length}</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Chapter</th><th>Level</th><th style={{ width: '22%' }}>Mastery</th><th className="r">Answered</th><th className="r">Qs / year</th></tr></thead>
              <tbody>
                {g.items.map((c) => {
                  const st = state.stats[c.id];
                  const p = plan[c.id];
                  const gens = generatorsFor(c.id).length;
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className="row" style={{ gap: 8, flexWrap: 'nowrap' }}><SubjectDot subject={c.subject} /><Link to={`/topics/${c.id}`}>{c.name}</Link></span>
                        <div className="tiny faint" style={{ marginLeft: 16 }}>{byChapter[c.id]?.length ?? 0} questions{gens ? ` + ${gens} generators` : ''} · Class {c.classLevel}</div>
                      </td>
                      <td><LevelBadge level={levelOf(st, now)} /></td>
                      <td><div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}><div style={{ flex: 1 }}><MasteryBar value={p.mastery} target={p.target} color={SUBJECT_COLOR[c.subject]} /></div><span className="num tiny" style={{ width: 34, textAlign: 'right' }}>{pct(p.mastery)}</span></div></td>
                      <td className="r num">{st ? `${st.correct}/${st.attempts}` : '–'}</td>
                      <td className="r num">{c.weight}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
