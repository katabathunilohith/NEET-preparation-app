import { useState, type FormEvent } from 'react';
import { setRole } from '../cloud/api';
import { useAuth } from '../cloud/auth';
import { marksForRank } from '../engine/predict';
import { snapshotPath } from '../engine/state';
import { useStore } from '../store/store';

export function Onboarding() {
  const { state, update } = useStore();
  const auth = useAuth();
  const [role, setRoleChoice] = useState<'student' | 'guardian'>('student');
  const [name, setName] = useState(state.profile.name || (auth.profile?.display_name ?? ''));
  const [examDate, setExamDate] = useState(state.profile.examDate);
  const [targetRank, setTargetRank] = useState(state.profile.targetRank);
  const [dailyGoal, setDailyGoal] = useState(state.profile.dailyGoal);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (role === 'guardian' && auth.session) {
      setBusy(true);
      await setRole(auth.session.user.id, 'guardian');
      await auth.refreshProfile();
      return;
    }
    update((s, now) =>
      snapshotPath({ ...s, profile: { ...s.profile, name: name.trim(), examDate, targetRank: Math.max(1, targetRank), dailyGoal, onboarded: true } }, now),
    );
  };

  return (
    <div className="auth">
      <form className="auth-panel" onSubmit={submit}>
        <div className="row between">
          <div className="wordmark">NEET Pathfinder</div>
          {auth.session && <button type="button" className="link-btn small" onClick={auth.signOut}>Sign out</button>}
        </div>
        <h1>Set up</h1>
        <p className="muted">A few details so the planner can work out what score you need and how to get there.</p>

        {auth.session && (
          <div className="choice" role="radiogroup" aria-label="Account type">
            <button type="button" role="radio" aria-checked={role === 'student'} className={role === 'student' ? 'on' : ''} onClick={() => setRoleChoice('student')}>
              Student<span>Preparing for NEET</span>
            </button>
            <button type="button" role="radio" aria-checked={role === 'guardian'} className={role === 'guardian' ? 'on' : ''} onClick={() => setRoleChoice('guardian')}>
              Parent / guardian<span>View a student’s progress</span>
            </button>
          </div>
        )}

        {role === 'student' ? (
          <>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="date">NEET exam date</label>
              <input id="date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="rank">Target All-India Rank</label>
              <input id="rank" type="number" min={1} value={targetRank} onChange={(e) => setTargetRank(Number(e.target.value))} required />
              <div className="hint">About {marksForRank(targetRank)}/720 needed, based on recent years.</div>
            </div>
            <div className="field">
              <label htmlFor="goal">Daily practice goal — {dailyGoal} questions</label>
              <input id="goal" type="range" min={10} max={120} step={5} value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} />
            </div>
          </>
        ) : (
          <p className="small muted">After continuing, ask the student to add <strong>{auth.session?.user.email}</strong> in Settings → Guardians.</p>
        )}
        <button className="btn primary block" type="submit" disabled={busy}>Continue</button>
      </form>
    </div>
  );
}
