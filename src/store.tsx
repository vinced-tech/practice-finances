import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadState, saveState } from './lib/db';
import type { AppState } from './lib/model';
import { sampleState } from './lib/seed';
import type { Period } from './lib/totals';

interface Store {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  saveError: string | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>({ year: new Date().getFullYear(), month: null });
  const loaded = useRef(false);

  useEffect(() => {
    loadState()
      .then((s) => {
        if (s) setState(s);
        else {
          // First open: show sample data so the screens aren't empty.
          const now = new Date();
          const sample = sampleState(now.getFullYear(), now.getMonth() + 1);
          setState(sample);
          saveState(sample).catch(() => undefined);
        }
        loaded.current = true;
      })
      .catch(() => setLoadError('This browser is blocking local storage (private browsing?). Your data can’t be saved here.'));
  }, []);

  // Save after every change (skips the very first render after loading).
  const lastSaved = useRef<AppState | null>(null);
  useEffect(() => {
    if (!state || !loaded.current) return;
    if (lastSaved.current === null) {
      lastSaved.current = state;
      return;
    }
    if (lastSaved.current === state) return;
    lastSaved.current = state;
    saveState(state).then(
      () => setSaveError(null),
      () => setSaveError('Couldn’t save your last change. Please download a backup from the More tab.'),
    );
  }, [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => (prev ? fn(prev) : prev));
  }, []);

  if (loadError) return <div className="page"><p className="alert">{loadError}</p></div>;
  if (!state) return <div className="page muted">Loading…</div>;
  return <Ctx.Provider value={{ state, update, period, setPeriod, saveError }}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}
