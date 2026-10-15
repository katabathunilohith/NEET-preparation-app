import { useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { dueCards } from '../engine/srs';
import { useStore, type SyncStatus } from '../store/store';
import { Icon } from './Icons';

const NAV = [
  { to: '/', label: 'Overview', icon: Icon.home, end: true },
  { to: '/path', label: 'Study path', icon: Icon.path },
  { to: '/topics', label: 'Practice', icon: Icon.book },
  { to: '/tests', label: 'Tests', icon: Icon.test },
  { to: '/mistakes', label: 'Mistakes', icon: Icon.mistake, count: true },
  { to: '/settings', label: 'Settings', icon: Icon.settings, student: true },
];

const SYNC_LABEL: Record<SyncStatus, string> = {
  local: 'Saved on this device',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline — will sync later',
  error: 'Sync problem — retrying',
};

interface Props {
  guardian?: { studentName: string; onExit: () => void };
}

export function Layout({ guardian }: Props) {
  const { state, saveError, sync, readOnly } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const due = dueCards(state, Date.now()).length;
  const nav = NAV.filter((n) => !(n.student && readOnly));

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="wordmark">NEET Pathfinder</div>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            {n.label}
            {n.count && due > 0 && <span className="nav-count">{due}</span>}
          </NavLink>
        ))}
        <div className="sidebar-foot">
          {!readOnly && <span className={`sync ${sync}`}><i />{SYNC_LABEL[sync]}</span>}
        </div>
      </aside>
      <div className="main">
        {guardian && (
          <div className="guardian-bar">
            <span>Viewing <strong>{guardian.studentName}</strong>’s progress · read-only</span>
            <button className="link-btn" onClick={guardian.onExit}>All students</button>
          </div>
        )}
        <header className="topbar">
          <span className="wordmark mobile-mark">NEET Pathfinder</span>
          {!readOnly && (
            <>
              <form onSubmit={onSearch} role="search">
                <input type="search" placeholder="Search chapters, concepts, questions" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
              </form>
              <NavLink to="/search" className="btn sm mobile-search" aria-label="Search"><Icon.search /></NavLink>
              <NavLink to="/tests/run/daily" className="btn primary sm">Daily test</NavLink>
            </>
          )}
        </header>
        <main className="content">
          {saveError && <div className="callout bad" style={{ marginBottom: 16 }}>{saveError}</div>}
          <Outlet />
        </main>
      </div>
      <nav className="bottom-nav">
        {nav.filter((n) => !n.student).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <n.icon />
            {n.label === 'Study path' ? 'Path' : n.label}
            {n.count && due > 0 && <span className="nav-count">{due}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
