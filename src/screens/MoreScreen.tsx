import { useRef, useState } from 'react';
import { useStore } from '../store';
import type { AppState } from '../lib/model';
import { addCategory, makeBackup, mergeCategories, readBackup, removeSampleData, renameCategory } from '../lib/ops';
import { Confirm, download, Modal } from '../ui/components';
import { todayISO } from '../lib/dates';

export default function MoreScreen() {
  const { state, update } = useStore();
  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [merging, setMerging] = useState<{ from: string; into: string } | null>(null);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [restoreState, setRestoreState] = useState<AppState | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmSample, setConfirmSample] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const count = (id: string) => state.expenses.filter((e) => e.categoryId === id).length;
  const name = (id: string) => state.categories.find((c) => c.id === id)?.name ?? '';
  const hasSample = state.income.some((i) => i.sample) || state.expenses.some((e) => e.sample);

  const onRestoreFile = async (f: File | undefined) => {
    setRestoreError('');
    setMessage('');
    if (!f) return;
    try {
      setRestoreState(readBackup(await f.text()));
    } catch (e) {
      setRestoreError((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <h1>More</h1>
      {message && <p className="success">{message}</p>}

      <section className="card">
        <h2>Backup</h2>
        <p className="sub">Your data lives only in this browser, on this device. Download a backup now and then — for example, once a month — and keep it somewhere safe.</p>
        <div className="row gap wrap">
          <button className="btn primary big" onClick={() => { download(`practice-finances-backup-${todayISO()}.json`, makeBackup(state), 'application/json'); setMessage('Backup downloaded.'); }}>
            Download backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restore from a backup…</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onRestoreFile(e.target.files?.[0])} />
        </div>
        {restoreError && <p className="alert">{restoreError}</p>}
      </section>

      <section className="card">
        <h2>Categories</h2>
        <ul className="entries">
          {state.categories.map((c) => (
            <li key={c.id} className="row between cat-row">
              <span>{c.name} <span className="muted small">· {count(c.id)} item{count(c.id) === 1 ? '' : 's'}</span></span>
              <span className="row gap">
                <button className="link" onClick={() => setRenaming({ id: c.id, name: c.name })}>Rename</button>
                {state.categories.length > 1 && (
                  <button className="link" onClick={() => setMerging({ from: c.id, into: state.categories.find((x) => x.id !== c.id)!.id })}>Merge…</button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <form className="row gap" onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) { update((s) => addCategory(s, newCat).state); setNewCat(''); } }}>
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" aria-label="New category name" />
          <button className="btn" type="submit">Add</button>
        </form>
      </section>

      {hasSample && (
        <section className="card">
          <h2>Sample data</h2>
          <p className="sub">The example entries you saw on first open.</p>
          <button className="btn" onClick={() => setConfirmSample(true)}>Remove sample data</button>
        </section>
      )}

      <section className="card">
        <h2>Privacy</h2>
        <p className="sub">Nothing you enter leaves this device. There’s no account and no server. Please don’t enter client names or health information — use “Private client” for private-pay sessions.</p>
      </section>

      <Modal open={renaming !== null} title="Rename category" onClose={() => setRenaming(null)}>
        {renaming && (
          <form className="form" onSubmit={(e) => { e.preventDefault(); update((s) => renameCategory(s, renaming.id, renaming.name)); setRenaming(null); }}>
            <label>New name<input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} autoFocus /></label>
            <div className="row end"><button className="btn primary" type="submit" disabled={!renaming.name.trim()}>Save</button></div>
          </form>
        )}
      </Modal>

      <Modal open={merging !== null && !confirmMerge} title={`Merge “${merging ? name(merging.from) : ''}”`} onClose={() => setMerging(null)}>
        {merging && (
          <div className="form">
            <p className="sub">Move all {count(merging.from)} items from “{name(merging.from)}” into another category. “{name(merging.from)}” will then be removed.</p>
            <label>
              Move into
              <select value={merging.into} onChange={(e) => setMerging({ ...merging, into: e.target.value })}>
                {state.categories.filter((c) => c.id !== merging.from).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="row end"><button className="btn primary" onClick={() => setConfirmMerge(true)}>Continue</button></div>
          </div>
        )}
      </Modal>
      <Confirm
        open={confirmMerge && merging !== null}
        title="Merge these categories?"
        body={merging ? `All items in “${name(merging.from)}” will move to “${name(merging.into)}”, and “${name(merging.from)}” will be deleted.` : ''}
        confirmLabel="Merge"
        onCancel={() => setConfirmMerge(false)}
        onConfirm={() => { const m = merging!; update((s) => mergeCategories(s, m.from, m.into)); setConfirmMerge(false); setMerging(null); }}
      />
      <Confirm
        open={restoreState !== null}
        title="Replace everything with this backup?"
        body={restoreState ? `The backup has ${restoreState.income.length} income and ${restoreState.expenses.length} expense entries. Everything currently in the app will be replaced. Tip: download a backup of the current data first.` : ''}
        confirmLabel="Replace with backup"
        onCancel={() => setRestoreState(null)}
        onConfirm={() => { const r = restoreState!; update(() => r); setRestoreState(null); setMessage('Backup restored.'); }}
      />
      <Confirm open={confirmSample} title="Remove the sample data?" body="Only the example entries are removed. Anything you added stays." confirmLabel="Remove sample data"
        onCancel={() => setConfirmSample(false)} onConfirm={() => { update(removeSampleData); setConfirmSample(false); }} />
    </>
  );
}
