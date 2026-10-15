import { useEffect, useRef, useState, type FormEvent } from 'react';
import { addGuardian, isAdmin, listGuardians, publishQuestions, removeGuardian } from '../cloud/api';
import { useAuth } from '../cloud/auth';
import { Seg } from '../components/Bits';
import { CHAPTERS } from '../data/syllabus';
import { validateQuestion } from '../engine/bank';
import { marksForRank } from '../engine/predict';
import { defaultState, migrate, snapshotPath } from '../engine/state';
import { OFFLINE_FLAG } from './LoginPage';
import { useStore } from '../store/store';
import type { Difficulty, Question } from '../types';
import { download } from '../util';

const SAMPLE = `[
  {
    "chapterId": "b-molecular",
    "difficulty": "medium",
    "concept": "Transcription",
    "text": "RNA polymerase III transcribes",
    "options": ["28S rRNA", "mRNA", "tRNA and 5S rRNA", "hnRNA"],
    "answer": 2,
    "explanation": "Pol I: rRNAs; Pol II: hnRNA; Pol III: tRNA, 5S rRNA, snRNA."
  }
]`;

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div><h2 style={{ marginBottom: 4 }}>{title}</h2>{hint && <p className="small faint">{hint}</p>}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { state, update, replace, userId, sync } = useStore();
  const auth = useAuth();
  const p = state.profile;
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState('');
  const [form, setForm] = useState({ chapterId: CHAPTERS[0].id, difficulty: 'medium' as Difficulty, concept: '', text: '', o0: '', o1: '', o2: '', o3: '', answer: 0, explanation: '' });
  const [guardians, setGuardians] = useState<string[]>([]);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [admin, setAdmin] = useState(false);
  const [target, setTarget] = useState<'mine' | 'shared'>('mine');

  useEffect(() => {
    if (!userId) return;
    listGuardians(userId).then(setGuardians).catch(() => undefined);
    isAdmin(userId).then(setAdmin).catch(() => undefined);
  }, [userId]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 4000);
  };

  const setProfile = (patch: Partial<typeof p>) => update((s, now) => snapshotPath({ ...s, profile: { ...s.profile, ...patch } }, now));

  const addQuestions = async (raw: unknown[]) => {
    const errors: string[] = [];
    const ok: Question[] = [];
    raw.forEach((r, i) => {
      const err = validateQuestion(r);
      if (err) return errors.push(`#${i + 1}: ${err}`);
      const o = r as Question;
      ok.push({
        id: `custom-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        chapterId: o.chapterId,
        difficulty: o.difficulty ?? 'medium',
        concept: (o.concept || 'General').toString().slice(0, 80),
        text: o.text.toString(),
        options: o.options.map(String),
        answer: o.answer,
        explanation: (o.explanation ?? '').toString(),
        custom: true,
      });
    });
    const skipped = errors.length ? ` Skipped ${errors.length}: ${errors.slice(0, 3).join('; ')}` : '';
    if (!ok.length) return flash(`Nothing added.${skipped}`);
    if (target === 'shared' && userId) {
      try {
        await publishQuestions(userId, ok);
        flash(`Published ${ok.length} to the shared bank. Every device picks them up at next sign-in.${skipped}`);
      } catch (e) {
        flash(`Publish failed: ${(e as Error).message}`);
      }
      return;
    }
    update((s) => ({ ...s, customQuestions: [...s.customQuestions, ...ok] }));
    flash(`Added ${ok.length} question${ok.length === 1 ? '' : 's'}.${skipped}`);
  };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    await addQuestions([{ chapterId: form.chapterId, difficulty: form.difficulty, concept: form.concept, text: form.text, options: [form.o0, form.o1, form.o2, form.o3], answer: Number(form.answer), explanation: form.explanation }]);
    setForm({ ...form, concept: '', text: '', o0: '', o1: '', o2: '', o3: '', explanation: '' });
  };

  const importBackup = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !('profile' in data)) throw new Error('This is not a NEET Pathfinder backup');
      if (!window.confirm('Replace all current progress with this backup?')) return;
      replace(migrate(data, Date.now()));
      flash('Backup restored.');
    } catch (e) {
      flash(`Import failed: ${(e as Error).message}`);
    }
  };

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    try {
      await addGuardian(userId, guardianEmail);
      setGuardians(await listGuardians(userId));
      setGuardianEmail('');
      flash('Guardian added. They can now sign in with that email to view progress.');
    } catch (err) {
      flash(`Could not add: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <div className="page-head"><div><div className="eyebrow">Settings</div><h1>Settings</h1></div></div>

      <Row title="Account" hint={auth.enabled ? 'Sign in to sync progress across devices.' : 'This build runs offline only.'}>
        {auth.session ? (
          <div className="stack" style={{ gap: 8 }}>
            <div>Signed in as <strong>{auth.session.user.email}</strong></div>
            <div className="small muted">Sync: {sync === 'synced' ? 'up to date' : sync}</div>
            <div><button className="btn sm" onClick={auth.signOut}>Sign out</button></div>
          </div>
        ) : auth.enabled ? (
          <div className="stack" style={{ gap: 8 }}>
            <div className="small muted">Progress is only on this device.</div>
            <div><button className="btn sm" onClick={() => { try { localStorage.removeItem(OFFLINE_FLAG); } catch { /* ignore */ } location.reload(); }}>Sign in to sync</button></div>
          </div>
        ) : (
          <div className="small muted">Progress is stored on this device. Use backups below to move it.</div>
        )}
      </Row>

      <Row title="Goal" hint="Changing the target re-plans the whole path.">
        <div className="grid g2">
          <div className="field"><label htmlFor="s-name">Name</label><input id="s-name" defaultValue={p.name} onBlur={(e) => setProfile({ name: e.target.value })} /></div>
          <div className="field"><label htmlFor="s-date">Exam date</label><input id="s-date" type="date" value={p.examDate} onChange={(e) => e.target.value && setProfile({ examDate: e.target.value })} /></div>
          <div className="field">
            <label htmlFor="s-rank">Target rank</label>
            <input id="s-rank" type="number" min={1} defaultValue={p.targetRank} onBlur={(e) => setProfile({ targetRank: Math.max(1, Number(e.target.value) || 1) })} />
            <div className="hint">About {marksForRank(p.targetRank)}/720 needed.</div>
          </div>
          <div className="field"><label htmlFor="s-goal">Daily goal — {p.dailyGoal} questions</label><input id="s-goal" type="range" min={10} max={120} step={5} value={p.dailyGoal} onChange={(e) => setProfile({ dailyGoal: Number(e.target.value) })} /></div>
        </div>
        <label>Theme</label>
        <Seg label="Theme" value={state.theme} onChange={(t) => update((s) => ({ ...s, theme: t }))} options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
      </Row>

      {userId && (
        <Row title="Guardians" hint="People who can view (not change) this progress. They sign in with the email you add here.">
          {guardians.length > 0 && (
            <table style={{ marginBottom: 12 }}>
              <tbody>
                {guardians.map((g) => (
                  <tr key={g}><td>{g}</td><td className="r"><button className="link-btn small" onClick={async () => { await removeGuardian(userId, g); setGuardians(await listGuardians(userId)); }}>Remove</button></td></tr>
                ))}
              </tbody>
            </table>
          )}
          <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={invite}>
            <input type="email" required placeholder="parent@example.com" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} aria-label="Guardian email" />
            <button className="btn" type="submit">Add</button>
          </form>
        </Row>
      )}

      <Row title="Add a question" hint="From coaching material or past papers. It joins the adaptive engine immediately.">
        {admin && (
          <div style={{ marginBottom: 14 }}>
            <Seg label="Destination" value={target} onChange={setTarget} options={[['mine', 'Only me'], ['shared', 'Shared bank (all users)']]} />
          </div>
        )}
        <form onSubmit={submitForm}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <select value={form.chapterId} onChange={(e) => setForm({ ...form, chapterId: e.target.value })} aria-label="Chapter">
              {CHAPTERS.map((c) => <option key={c.id} value={c.id}>{c.subject} — {c.name}</option>)}
            </select>
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value as Difficulty })} aria-label="Difficulty" style={{ width: 120 }}>
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </div>
          <div className="field" style={{ marginTop: 10 }}><input placeholder="Concept, e.g. Hardy–Weinberg" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} aria-label="Concept" /></div>
          <div className="field"><textarea placeholder="Question" rows={3} required value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} aria-label="Question text" /></div>
          {([0, 1, 2, 3] as const).map((i) => (
            <div key={i} className="row" style={{ flexWrap: 'nowrap', marginBottom: 8 }}>
              <input type="radio" name="ans" checked={form.answer === i} onChange={() => setForm({ ...form, answer: i })} aria-label={`Option ${'ABCD'[i]} is correct`} />
              <input placeholder={`Option ${'ABCD'[i]}`} required value={form[`o${i}`]} onChange={(e) => setForm({ ...form, [`o${i}`]: e.target.value })} aria-label={`Option ${'ABCD'[i]}`} />
            </div>
          ))}
          <p className="tiny faint">Select the radio button next to the correct option.</p>
          <div className="field"><textarea placeholder="Explanation (optional)" rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} aria-label="Explanation" /></div>
          <button className="btn primary" type="submit">{target === 'shared' ? 'Publish question' : 'Add question'}</button>
        </form>
      </Row>

      <Row title="Bulk import" hint="Paste a JSON array. chapterId must be one of the ids listed below; answer is 0–3.">
        <textarea rows={8} value={json} onChange={(e) => setJson(e.target.value)} placeholder={SAMPLE} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} aria-label="Questions JSON" />
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn primary" onClick={() => {
            try {
              const data = JSON.parse(json);
              addQuestions(Array.isArray(data) ? data : [data]);
              setJson('');
            } catch (e) {
              flash(`Invalid JSON: ${(e as Error).message}`);
            }
          }}>Import</button>
          <button className="btn" onClick={() => setJson(SAMPLE)}>Show example</button>
          <span className="small faint">Your questions: {state.customQuestions.length}</span>
          {state.customQuestions.length > 0 && <button className="link-btn small" onClick={() => window.confirm('Delete all of your own questions?') && update((s) => ({ ...s, customQuestions: [] }))}>Delete mine</button>}
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="small">Chapter ids</summary>
          <div className="tiny muted" style={{ columns: 2, marginTop: 8 }}>{CHAPTERS.map((c) => <div key={c.id}><code>{c.id}</code> {c.name}</div>)}</div>
        </details>
      </Row>

      <Row title="Backup" hint="Download everything as a file, or restore from one.">
        <div className="row">
          <button className="btn" onClick={() => download(`neet-pathfinder-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state))}>Download backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
        </div>
      </Row>

      <Row title="Reset" hint="Erases progress, tests and your own questions. Download a backup first.">
        <button className="btn danger" onClick={() => {
          if (window.confirm('Erase all progress? This cannot be undone.')) {
            replace(defaultState(Date.now()));
            flash('All data reset.');
          }
        }}>Erase all progress</button>
      </Row>
      {msg && <div className="toast" role="status">{msg}</div>}
    </>
  );
}
