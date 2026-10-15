import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchSharedQuestions, fetchState, saveState } from '../cloud/api';
import { supabase } from '../cloud/client';
import { setSharedQuestions } from '../engine/bank';
import { buildPath, dateKey, type StudyPath } from '../engine/path';
import { defaultState, migrate, snapshotPath } from '../engine/state';
import type { AppState, Question } from '../types';

const LOCAL_KEY = 'neet-pathfinder:state';
const BANK_KEY = 'neet-pathfinder:shared-bank';
const keyFor = (userId?: string) => (userId ? `${LOCAL_KEY}:${userId}` : LOCAL_KEY);

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error';

function readLocal(key: string): AppState | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? migrate(JSON.parse(raw), Date.now()) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Shared questions cached from the last session, so the bank works offline too.
try {
  const cached = JSON.parse(localStorage.getItem(BANK_KEY) ?? '[]') as Question[];
  if (Array.isArray(cached)) setSharedQuestions(cached);
} catch {
  /* ignore */
}

export interface Store {
  state: AppState;
  path: StudyPath;
  update: (fn: (s: AppState, now: number) => AppState) => void;
  replace: (s: AppState) => void;
  saveError: string | null;
  sync: SyncStatus;
  /** True when a guardian is viewing a student's data. */
  readOnly: boolean;
  userId?: string;
}

const Ctx = createContext<Store | null>(null);

/**
 * Local-first store. Progress is always saved on the device; when signed in it is also
 * mirrored to Supabase (newest copy wins) and live-updated from her other devices.
 */
export function StoreProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const key = keyFor(userId);
  const [state, setState] = useState<AppState>(() => {
    const own = readLocal(key);
    if (own) return own;
    // First sign-in on this device: move progress made before creating an account into it.
    // The offline copy is removed so it can never leak into a second account (e.g. a parent's).
    const anon = userId ? readLocal(LOCAL_KEY) : null;
    return anon ?? defaultState(Date.now());
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus>(userId && supabase ? 'syncing' : 'local');
  const [bankVersion, setBankVersion] = useState(0);
  const fromRemote = useRef(false);
  const pulled = useRef(!userId);
  const latest = useRef(state);
  latest.current = state;

  // The offline copy now belongs to this account; remove it so it can't be adopted by another one.
  useEffect(() => {
    if (!userId) return;
    try {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(latest.current));
      localStorage.removeItem(LOCAL_KEY);
    } catch {
      /* ignore */
    }
  }, [userId, key]);

  // Save locally on every change.
  useEffect(() => {
    const t = setTimeout(() => {
      if (writeLocal(key, state)) setSaveError(null);
      else setSaveError('Could not save on this device (storage full or blocked). Export a backup from Settings.');
    }, 150);
    return () => clearTimeout(t);
  }, [key, state]);

  // Pull from the cloud once after sign-in, then keep the newest copy.
  useEffect(() => {
    if (!userId || !supabase) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchState(userId);
        if (cancelled) return;
        const local = latest.current;
        if (remote && (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
          fromRemote.current = true;
          setState(migrate(remote, Date.now()));
        } else if (local.profile.onboarded) {
          await saveState(userId, local);
        }
        pulled.current = true;
        setSync('synced');
      } catch (e) {
        console.error('sync pull', e);
        pulled.current = true;
        setSync(navigator.onLine ? 'error' : 'offline');
      }
    })();
    fetchSharedQuestions()
      .then((qs) => {
        if (cancelled) return;
        setSharedQuestions(qs);
        writeLocal(BANK_KEY, qs);
        setBankVersion((v) => v + 1);
      })
      .catch((e) => console.error('shared bank', e));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Push local changes (debounced).
  useEffect(() => {
    if (!userId || !supabase || !pulled.current) return;
    if (fromRemote.current) {
      fromRemote.current = false;
      return;
    }
    if (!state.profile.onboarded) return;
    setSync('syncing');
    const t = setTimeout(() => {
      saveState(userId, state)
        .then(() => setSync('synced'))
        .catch((e) => {
          console.error('sync push', e);
          setSync(navigator.onLine ? 'error' : 'offline');
        });
    }, 1500);
    return () => clearTimeout(t);
  }, [userId, state]);

  // Live updates from her other devices.
  useEffect(() => {
    if (!userId || !supabase) return;
    const client = supabase;
    const channel = client
      .channel(`state-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_state', filter: `user_id=eq.${userId}` }, (payload) => {
        const remote = (payload.new as { state?: AppState } | null)?.state;
        if (remote && (remote.updatedAt ?? 0) > (latest.current.updatedAt ?? 0)) {
          fromRemote.current = true;
          setState(migrate(remote, Date.now()));
        }
      })
      .subscribe();
    const onFocus = () => {
      if (document.visibilityState !== 'visible') return;
      fetchState(userId)
        .then((remote) => {
          if (remote && (remote.updatedAt ?? 0) > (latest.current.updatedAt ?? 0)) {
            fromRemote.current = true;
            setState(migrate(remote, Date.now()));
          }
        })
        .catch(() => setSync('offline'));
    };
    document.addEventListener('visibilitychange', onFocus);
    const onOnline = () => setState((s) => ({ ...s })); // retry push
    window.addEventListener('online', onOnline);
    return () => {
      client.removeChannel(channel);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [userId]);

  // Keep several open tabs on this device in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        const next = migrate(JSON.parse(e.newValue), Date.now());
        if (next.updatedAt > latest.current.updatedAt) {
          fromRemote.current = true;
          setState(next);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  // Re-plan once per day even without new answers (forgetting curve moves priorities).
  useEffect(() => {
    if (!state.profile.onboarded) return;
    const last = state.pathHistory[state.pathHistory.length - 1];
    if (!last || dateKey(last.at) !== dateKey(Date.now())) setState((s) => snapshotPath(s, Date.now()));
  }, [state.profile.onboarded, state.pathHistory]);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  const update = useCallback((fn: (s: AppState, now: number) => AppState) => {
    setState((s) => {
      const now = Date.now();
      const next = fn(s, now);
      return next === s ? s : { ...next, updatedAt: Math.max(now, s.updatedAt + 1) };
    });
  }, []);
  const replace = useCallback((s: AppState) => setState({ ...s, updatedAt: Date.now() }), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const path = useMemo(() => buildPath(state, Date.now()), [state, bankVersion]);

  return <Ctx.Provider value={{ state, path, update, replace, saveError, sync, readOnly: false, userId }}>{children}</Ctx.Provider>;
}

/** Read-only store for a guardian viewing a student's progress. */
export function ReadOnlyStoreProvider({ state, children }: { state: AppState; children: ReactNode }) {
  const path = useMemo(() => buildPath(state, Date.now()), [state]);
  const noop = useCallback(() => undefined, []);
  return <Ctx.Provider value={{ state, path, update: noop, replace: noop, saveError: null, sync: 'synced', readOnly: true }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
