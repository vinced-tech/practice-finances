import { useState } from 'react';
import { useStore } from '../store';
import { formatDate, MONTH_NAMES, monthOf, todayISO, yearOf, isValidISODate } from '../lib/dates';
import type { Income } from '../lib/model';
import { newId } from '../lib/model';
import { centsToPlain, formatUSD, parseCents } from '../lib/money';
import { addSource } from '../lib/ops';
import { sourceTotals, totalIncome, yearsWithData } from '../lib/totals';
import { Confirm, Modal, Money, PeriodPicker } from '../ui/components';

const NEW_SOURCE = '__new__';

export default function IncomeScreen() {
  const { state, update, period, setPeriod } = useStore();
  const [editing, setEditing] = useState<Income | 'new' | null>(null);
  const years = yearsWithData(state, new Date().getFullYear());
  const list = state.income
    .filter((i) => yearOf(i.date) === period.year && (period.month === null || monthOf(i.date) === period.month))
    .sort((a, b) => b.date.localeCompare(a.date));
  const sourceName = new Map(state.sources.map((s) => [s.id, s.name]));

  const byMonth = new Map<number, Income[]>();
  for (const i of list) byMonth.set(monthOf(i.date), [...(byMonth.get(monthOf(i.date)) ?? []), i]);

  return (
    <>
      <div className="row between wrap">
        <div>
          <h1>Money in</h1>
          <p className="sub">Income</p>
        </div>
        <button className="btn primary big" onClick={() => setEditing('new')}>+ Add money in</button>
      </div>
      <PeriodPicker period={period} setPeriod={setPeriod} years={years} />

      <section className="card">
        <div className="row between">
          <h2>Total</h2>
          <Money cents={totalIncome(list)} className="big-num in-ink" />
        </div>
        <ul className="plain">
          {sourceTotals(list, state.sources).map((s) => (
            <li key={s.sourceId} className="row between"><span>{s.name}</span><Money cents={s.cents} /></li>
          ))}
        </ul>
      </section>

      {list.length === 0 && <p className="muted center">No income recorded for this period yet.</p>}

      {[...byMonth.entries()].map(([m, items]) => (
        <section key={m} className="card">
          <div className="row between">
            <h2>{MONTH_NAMES[m - 1]}</h2>
            <Money cents={totalIncome(items)} className="in-ink strong" />
          </div>
          <p className="sub">
            {sourceTotals(items, state.sources).map((s) => `${s.name} ${formatUSD(s.cents)}`).join(' · ')}
          </p>
          <ul className="entries">
            {items.map((i) => (
              <li key={i.id}>
                <button className="entry" onClick={() => setEditing(i)}>
                  <span className="entry-main">
                    <span>{sourceName.get(i.sourceId) ?? 'Unknown'}</span>
                    <span className="muted small">{formatDate(i.date)}{i.note ? ` · ${i.note}` : ''}{i.sample ? ' · sample' : ''}</span>
                  </span>
                  <Money cents={i.amountCents} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Modal open={editing !== null} title={editing === 'new' ? 'Add money in' : 'Edit money in'} onClose={() => setEditing(null)}>
        {editing !== null && (
          <IncomeForm
            initial={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
            onSave={(entry, newSourceName) =>
              update((s) => {
                let next = s;
                let sourceId = entry.sourceId;
                if (newSourceName) ({ state: next, id: sourceId } = addSource(next, newSourceName));
                const e = { ...entry, sourceId };
                const exists = next.income.some((x) => x.id === e.id);
                return { ...next, income: exists ? next.income.map((x) => (x.id === e.id ? e : x)) : [...next.income, e] };
              })
            }
            onDelete={(id) => update((s) => ({ ...s, income: s.income.filter((x) => x.id !== id) }))}
          />
        )}
      </Modal>
    </>
  );
}

function IncomeForm({ initial, onSave, onDelete, onDone }: { initial: Income | null; onSave: (i: Income, newSource?: string) => void; onDelete: (id: string) => void; onDone: () => void }) {
  const { state } = useStore();
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [sourceId, setSourceId] = useState(initial?.sourceId ?? state.sources[0]?.id ?? NEW_SOURCE);
  const [newSource, setNewSource] = useState('');
  const [amount, setAmount] = useState(initial ? centsToPlain(initial.amountCents) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseCents(amount);
    if (!isValidISODate(date)) return setError('Please pick a date.');
    if (cents === null || cents <= 0) return setError('Please enter an amount like 1250.00');
    if (sourceId === NEW_SOURCE && !newSource.trim()) return setError('Please name the new source.');
    onSave(
      { id: initial?.id ?? newId(), date, sourceId, amountCents: cents, note: note.trim() || undefined },
      sourceId === NEW_SOURCE ? newSource : undefined,
    );
    onDone();
  };

  return (
    <form onSubmit={submit} className="form">
      <p className="privacy">🔒 Please don’t enter client names or any health details. For private-pay sessions, just choose “Private client”.</p>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>
        Where it came from
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          {state.sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value={NEW_SOURCE}>+ Add a new source…</option>
        </select>
      </label>
      {sourceId === NEW_SOURCE && (
        <label>New source name<input value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="e.g. Headway" autoFocus /></label>
      )}
      <label>Amount ($)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required /></label>
      <label>Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. March payout" maxLength={80} /></label>
      {error && <p className="alert">{error}</p>}
      <div className="row between">
        {initial ? <button type="button" className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>Delete</button> : <span />}
        <button className="btn primary" type="submit">Save</button>
      </div>
      <Confirm
        open={confirmDelete}
        title="Delete this income entry?"
        body="This can’t be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => { onDelete(initial!.id); onDone(); }}
      />
    </form>
  );
}
