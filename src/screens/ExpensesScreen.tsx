import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { formatDate, isValidISODate, MONTH_NAMES, monthOf, todayISO } from '../lib/dates';
import { buildImportPreview, commitImport, suggestCategory, type ImportPreview, type PreviewRow } from '../lib/importer';
import { merchantKey } from '../lib/merchant';
import type { AppState, Expense } from '../lib/model';
import { newId } from '../lib/model';
import { centsToPlain, parseCents } from '../lib/money';
import { learnRule } from '../lib/ops';
import { detectSubscriptions, isSubscriptionMerchant } from '../lib/subscriptions';
import { inPeriod, totalExpenses, yearsWithData } from '../lib/totals';
import { Confirm, ExpenseAmount, Modal, Money, PeriodPicker } from '../ui/components';

type View = 'business' | 'subscriptions' | 'personal';

export default function ExpensesScreen() {
  const { state, update, period, setPeriod } = useStore();
  const [view, setView] = useState<View>('business');
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileError, setFileError] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const years = yearsWithData(state, new Date().getFullYear());

  const subs = useMemo(() => detectSubscriptions(state.expenses, state.notSubscriptions), [state.expenses, state.notSubscriptions]);
  const isSub = isSubscriptionMerchant(subs);

  const onFile = async (f: File | undefined) => {
    setFileError('');
    setDoneMsg('');
    if (!f) return;
    const p = buildImportPreview(await f.text(), state);
    if (p.error) setFileError(p.error);
    else setPreview(p);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (preview)
    return (
      <ImportPreviewScreen
        preview={preview}
        onCancel={() => setPreview(null)}
        onSave={(rows) => {
          const n = rows.filter((r) => r.include).length;
          update((s) => commitImport(s, rows).state);
          setPreview(null);
          setDoneMsg(`Done — ${n} item${n === 1 ? '' : 's'} added.`);
        }}
      />
    );

  const inP = state.expenses.filter((e) => inPeriod(e.date, period)).sort((a, b) => b.date.localeCompare(a.date));
  const list = inP.filter((e) => (view === 'personal' ? e.personal : !e.personal));

  return (
    <>
      <div className="row between wrap">
        <div>
          <h1>Money out</h1>
          <p className="sub">Expenses</p>
        </div>
        <div className="row gap wrap">
          <button className="btn" onClick={() => setEditing('new')}>Add one by hand</button>
          <button className="btn primary big" onClick={() => fileRef.current?.click()}>⇪ Import card statement</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>
      {fileError && <p className="alert">{fileError}</p>}
      {doneMsg && <p className="success">{doneMsg}</p>}

      <div className="segmented no-print" role="tablist">
        {(['business', 'subscriptions', 'personal'] as View[]).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
            {v === 'business' ? 'Business' : v === 'subscriptions' ? `Subscriptions (${subs.length})` : 'Personal'}
          </button>
        ))}
      </div>

      {view === 'subscriptions' ? (
        <SubscriptionsView subs={subs} state={state} onDismiss={(k) => update((s) => ({ ...s, notSubscriptions: [...s.notSubscriptions, k] }))} />
      ) : (
        <>
          <PeriodPicker period={period} setPeriod={setPeriod} years={years} />
          {view === 'personal' && <p className="note">Personal items are kept here for your records, but they are <strong>not</strong> counted in any business totals or tax figures.</p>}
          <ExpenseList list={list} state={state} isSub={isSub} onOpen={setEditing} total={totalExpenses(list)} />
        </>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Add an expense' : 'Edit expense'} onClose={() => setEditing(null)}>
        {editing !== null && (
          <ExpenseForm
            initial={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
            onSave={(exp, applyToOthers) =>
              update((s) => {
                const old = s.expenses.find((x) => x.id === exp.id);
                let expenses = old ? s.expenses.map((x) => (x.id === exp.id ? exp : x)) : [...s.expenses, exp];
                let next: AppState = { ...s, expenses };
                const changed: { categoryId?: string; personal?: boolean } = {};
                if (old && old.categoryId !== exp.categoryId) changed.categoryId = exp.categoryId;
                if (old && old.personal !== exp.personal) changed.personal = exp.personal;
                if (Object.keys(changed).length) {
                  next = learnRule(next, exp.merchantKey, changed);
                  if (applyToOthers)
                    next = { ...next, expenses: next.expenses.map((x) => (x.merchantKey === exp.merchantKey ? { ...x, ...changed } : x)) };
                }
                return next;
              })
            }
            onDelete={(id) => update((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== id) }))}
          />
        )}
      </Modal>
    </>
  );
}

function ExpenseList({ list, state, isSub, onOpen, total }: { list: Expense[]; state: AppState; isSub: (k: string) => boolean; onOpen: (e: Expense) => void; total: number }) {
  const catName = new Map(state.categories.map((c) => [c.id, c.name]));
  const byMonth = new Map<number, Expense[]>();
  for (const e of list) byMonth.set(monthOf(e.date), [...(byMonth.get(monthOf(e.date)) ?? []), e]);
  if (list.length === 0) return <p className="muted center">Nothing here for this period.</p>;
  return (
    <>
      <section className="card row between">
        <h2>Total</h2>
        <Money cents={total} className="big-num out-ink" />
      </section>
      {[...byMonth.entries()].map(([m, items]) => (
        <section className="card" key={m}>
          <div className="row between">
            <h2>{MONTH_NAMES[m - 1]}</h2>
            <Money cents={totalExpenses(items)} className="out-ink strong" />
          </div>
          <ul className="entries">
            {items.map((e) => (
              <li key={e.id}>
                <button className="entry" onClick={() => onOpen(e)}>
                  <span className="entry-main">
                    <span>
                      {e.description}
                      {isSub(e.merchantKey) && e.kind === 'expense' && <span className="badge">monthly</span>}
                      {e.kind === 'refund' && <span className="badge refund">refund</span>}
                    </span>
                    <span className="muted small">{formatDate(e.date)} · {catName.get(e.categoryId) ?? 'Other'}{e.sample ? ' · sample' : ''}</span>
                  </span>
                  <Money cents={e.amountCents} className={e.kind === 'refund' ? 'refund-ink' : ''} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function SubscriptionsView({ subs, state, onDismiss }: { subs: ReturnType<typeof detectSubscriptions>; state: AppState; onDismiss: (k: string) => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const catName = new Map(state.categories.map((c) => [c.id, c.name]));
  const biz = subs.filter((s) => !s.personal);
  const personal = subs.filter((s) => s.personal);
  const Block = ({ title, items }: { title: string; items: typeof subs }) => (
    <section className="card">
      <div className="row between wrap">
        <h2>{title}</h2>
        <span className="muted">
          <Money cents={items.reduce((t, s) => t + s.monthlyCents, 0)} /> a month · <Money cents={items.reduce((t, s) => t + s.yearlyCents, 0)} /> a year
        </span>
      </div>
      {items.length === 0 ? <p className="muted">None found.</p> : (
        <table className="table">
          <thead><tr><th>Service</th><th className="num">Monthly</th><th className="num">Yearly</th></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.merchantKey}>
                <td>
                  {s.name}
                  <div className="muted small">{catName.get(s.categoryId) ?? 'Other'} · seen in {s.monthsSeen} months · last {formatDate(s.lastDate)}</div>
                  <button className="link small no-print" onClick={() => setConfirm(s.merchantKey)}>Not a subscription</button>
                </td>
                <td className="num"><Money cents={s.monthlyCents} /></td>
                <td className="num"><Money cents={s.yearlyCents} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
  return (
    <>
      <p className="note">These are charges from the same place at about the same price in 3 or more months. Yearly cost is the latest monthly charge × 12.</p>
      <Block title="Business subscriptions" items={biz} />
      <Block title="Personal subscriptions" items={personal} />
      <Confirm open={confirm !== null} title="Stop listing this as a subscription?" confirmLabel="Yes, remove from list" danger={false}
        onCancel={() => setConfirm(null)} onConfirm={() => { onDismiss(confirm!); setConfirm(null); }} />
    </>
  );
}

function ExpenseForm({ initial, onSave, onDelete, onDone }: { initial: Expense | null; onSave: (e: Expense, applyToOthers: boolean) => void; onDelete: (id: string) => void; onDone: () => void }) {
  const { state } = useStore();
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [amount, setAmount] = useState(initial ? centsToPlain(initial.amountCents) : '');
  const [kind, setKind] = useState<Expense['kind']>(initial?.kind ?? 'expense');
  const [personal, setPersonal] = useState(initial?.personal ?? false);
  const [applyToOthers, setApplyToOthers] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mk = initial?.merchantKey ?? merchantKey(description);
  const others = initial ? state.expenses.filter((x) => x.merchantKey === mk && x.id !== initial.id).length : 0;
  const changedSomething = initial && (initial.categoryId !== categoryId || initial.personal !== personal);
  const effectiveCategory = categoryId || suggestCategory(description, '', state);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseCents(amount);
    if (!isValidISODate(date)) return setError('Please pick a date.');
    if (!description.trim()) return setError('Please describe the expense.');
    if (cents === null || cents <= 0) return setError('Please enter an amount like 29.95');
    onSave(
      {
        id: initial?.id ?? newId(),
        date,
        description: description.trim(),
        merchantKey: initial && initial.description === description.trim() ? initial.merchantKey : merchantKey(description),
        categoryId: effectiveCategory,
        amountCents: cents,
        kind,
        personal,
        origin: initial?.origin ?? 'manual',
        sample: initial?.sample,
      },
      applyToOthers,
    );
    onDone();
  };

  return (
    <form onSubmit={submit} className="form">
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>What was it?<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Liability insurance" required /></label>
      <label>
        Category
        <select value={effectiveCategory} onChange={(e) => setCategoryId(e.target.value)}>
          {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Amount ($)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required /></label>
      <fieldset className="toggle">
        <legend>This is a…</legend>
        <button type="button" className={kind === 'expense' ? 'on' : ''} onClick={() => setKind('expense')}>Purchase</button>
        <button type="button" className={kind === 'refund' ? 'on' : ''} onClick={() => setKind('refund')}>Refund</button>
      </fieldset>
      <fieldset className="toggle">
        <legend>Business or personal?</legend>
        <button type="button" className={!personal ? 'on' : ''} onClick={() => setPersonal(false)}>Business</button>
        <button type="button" className={personal ? 'on' : ''} onClick={() => setPersonal(true)}>Personal</button>
      </fieldset>
      {changedSomething && (
        <label className="check">
          <input type="checkbox" checked={applyToOthers} onChange={(e) => setApplyToOthers(e.target.checked)} />
          {others > 0 ? `Also update the ${others} other “${initial!.description}” item${others > 1 ? 's' : ''}.` : 'Remember this for future imports.'}
          {others > 0 && <span className="muted small"> Future imports will remember this either way.</span>}
        </label>
      )}
      {error && <p className="alert">{error}</p>}
      <div className="row between">
        {initial ? <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>Delete</button> : <span />}
        <button className="btn primary" type="submit">Save</button>
      </div>
      <Confirm open={confirmDelete} title="Delete this expense?" body="This can’t be undone." confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)} onConfirm={() => { onDelete(initial!.id); onDone(); }} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Import preview
// ---------------------------------------------------------------------------

function ImportPreviewScreen({ preview, onSave, onCancel }: { preview: ImportPreview; onSave: (rows: PreviewRow[]) => void; onCancel: () => void }) {
  const { state } = useStore();
  const [rows, setRows] = useState(preview.rows);
  const [showDupes, setShowDupes] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const setRow = (idx: number, change: Partial<PreviewRow>) =>
    setRows((rs) => {
      const target = rs[idx];
      return rs.map((r, i) => {
        if (i === idx) return { ...r, ...change };
        // A category or personal choice applies to every row from the same merchant.
        if (r.merchantKey === target.merchantKey && r.status === 'new' && ('categoryId' in change || 'personal' in change)) {
          const c: Partial<PreviewRow> = {};
          if ('categoryId' in change) c.categoryId = change.categoryId;
          if ('personal' in change) c.personal = change.personal;
          return { ...r, ...c };
        }
        return r;
      });
    });

  const included = rows.filter((r) => r.include);
  const newCount = rows.filter((r) => r.status === 'new').length;
  const dupCount = rows.length - newCount;
  const bizTotal = included.filter((r) => !r.personal).reduce((t, r) => t + (r.kind === 'refund' ? -r.amountCents : r.amountCents), 0);
  const yearsInFile = [...new Set(included.map((r) => r.date.slice(0, 4)))].sort();
  const visible = rows.map((r, i) => ({ r, i })).filter(({ r }) => showDupes || r.status === 'new');

  return (
    <>
      <h1>Check your statement</h1>
      <p className="sub">Nothing is saved until you press the button at the bottom.</p>
      <div className="card summary-line">
        <span><strong>{newCount}</strong> new</span>
        {dupCount > 0 && <span><strong>{dupCount}</strong> already imported (skipped)</span>}
        {preview.skipped.length > 0 && <span><strong>{preview.skipped.length}</strong> not purchases (skipped)</span>}
        <span>Business total of checked items: <ExpenseAmount cents={bizTotal} /></span>
      </div>
      {yearsInFile.length > 1 && (
        <p className="note">This statement includes purchases from {yearsInFile.join(' and ')}. Each one is counted in the year it was made (by Transaction Date).</p>
      )}
      <p className="note">Fix any category, switch items to <strong>Personal</strong>, or uncheck anything you don’t want. Changes apply to every row from the same place and are remembered next time.</p>

      {dupCount > 0 && (
        <label className="check"><input type="checkbox" checked={showDupes} onChange={(e) => setShowDupes(e.target.checked)} /> Show items already imported</label>
      )}

      <div className="preview">
        {visible.map(({ r, i }) => (
          <div key={i} className={`prow ${r.include ? '' : 'off'} ${r.personal ? 'is-personal' : ''}`}>
            <label className="prow-check">
              <input type="checkbox" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} aria-label={`Include ${r.description}`} />
            </label>
            <div className="prow-main">
              <div className="row between">
                <span className="strong">{r.description}</span>
                <span>
                  {r.kind === 'refund' && <span className="badge refund">refund</span>}
                  <Money cents={r.amountCents} className={r.kind === 'refund' ? 'refund-ink' : ''} />
                </span>
              </div>
              <div className="muted small">
                {formatDate(r.date)}{r.status === 'duplicate' && ' · already imported'}
              </div>
              <div className="row gap wrap prow-controls">
                <select value={r.categoryId} onChange={(e) => setRow(i, { categoryId: e.target.value })} aria-label="Category">
                  {state.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="toggle small-toggle">
                  <button type="button" className={!r.personal ? 'on' : ''} onClick={() => setRow(i, { personal: false })}>Business</button>
                  <button type="button" className={r.personal ? 'on' : ''} onClick={() => setRow(i, { personal: true })}>Personal</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {preview.skipped.length > 0 && (
        <details className="card">
          <summary>{preview.skipped.length} line(s) skipped — why?</summary>
          <ul className="plain">{preview.skipped.map((s) => <li key={s.line}>Line {s.line}: {s.description || '(no description)'} — {s.reason}</li>)}</ul>
        </details>
      )}

      <div className="sticky-actions">
        <button className="btn" onClick={() => setConfirmCancel(true)}>Cancel</button>
        <button className="btn primary big" disabled={included.length === 0} onClick={() => onSave(rows)}>
          Add {included.length} item{included.length === 1 ? '' : 's'}
        </button>
      </div>
      <Confirm open={confirmCancel} title="Discard this import?" body="Nothing from this file will be saved." confirmLabel="Discard"
        onCancel={() => setConfirmCancel(false)} onConfirm={onCancel} />
    </>
  );
}
