import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MONTH_NAMES, MONTH_SHORT } from '../lib/dates';
import { formatUSD, type Cents } from '../lib/money';
import type { Period } from '../lib/totals';

/** Money. Expenses are never shown with a minus sign; only net can be negative ("loss"). */
export function Money({ cents, signed = false, className = '' }: { cents: Cents; signed?: boolean; className?: string }) {
  return <span className={`money ${className}`}>{formatUSD(cents, { showSign: signed })}</span>;
}

/** An expense total. If refunds outweigh purchases it reads "$8.87 credit" — still no minus sign. */
export function ExpenseAmount({ cents }: { cents: Cents }) {
  return cents < 0 ? (
    <span><Money cents={cents} className="refund-ink" /> <span className="badge refund">credit</span></span>
  ) : (
    <Money cents={cents} />
  );
}

export function PeriodPicker({ period, setPeriod, years, allowMonth = true }: { period: Period; setPeriod: (p: Period) => void; years: number[]; allowMonth?: boolean }) {
  return (
    <div className="filters no-print">
      <label>
        <span className="sr-only">Year</span>
        <select value={period.year} onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      {allowMonth && (
        <label>
          <span className="sr-only">Month</span>
          <select value={period.month ?? ''} onChange={(e) => setPeriod({ ...period, month: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Whole year</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export const periodLabel = (p: Period) => (p.month ? `${MONTH_NAMES[p.month - 1]} ${p.year}` : String(p.year));

/** A modal "Are you sure?" built on the native <dialog>. */
export function Confirm({ open, title, body, confirmLabel, onConfirm, onCancel, danger = true }: { open: boolean; title: string; body?: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <h2>{title}</h2>
      {body && <div className="muted">{body}</div>}
      <div className="row end gap">
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className={danger ? 'btn danger' : 'btn primary'} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}

/** Generic modal for forms. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="row between">
        <h2>{title}</h2>
        <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {open && children}
    </dialog>
  );
}

/** Big summary card: plain-language label, formal term underneath. */
export function StatCard({ label, formal, cents, tone, signed = false }: { label: string; formal: string; cents: Cents; tone: 'in' | 'out' | 'net'; signed?: boolean }) {
  return (
    <div className={`stat stat-${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-formal">{formal}</div>
      <Money cents={cents} signed={signed} className="stat-value" />
      {tone === 'net' && cents < 0 && <div className="stat-note">A loss for this period</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts (plain HTML/SVG, no chart library)
// ---------------------------------------------------------------------------

/** Rounds a max value up to a tidy number for the axis. */
function niceMax(cents: number): number {
  if (cents <= 0) return 100_00;
  const dollars = cents / 100;
  const pow = 10 ** Math.floor(Math.log10(dollars));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= dollars)! * pow;
  return Math.round(step * 100);
}
const short = (cents: number) => {
  const d = cents / 100;
  return d >= 1000 ? `$${(d / 1000).toFixed(d % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(d)}`;
};

export function MonthlyChart({ months, selected, onSelect }: { months: { income: Cents; expenses: Cents }[]; selected: number | null; onSelect: (m: number | null) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = niceMax(Math.max(...months.flatMap((m) => [m.income, m.expenses])));
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const H = 180;
  const h = (c: number) => (Math.max(0, c) / max) * H;
  const active = hover ?? selected;

  return (
    <div className="chart">
      <div className="row between wrap">
        <div className="legend">
          <span><i className="swatch in" /> Money in</span>
          <span><i className="swatch out" /> Money out</span>
        </div>
        <button className="link no-print" onClick={() => setShowTable(!showTable)}>{showTable ? 'Show chart' : 'Show as table'}</button>
      </div>

      {showTable ? (
        <table className="table compact">
          <thead><tr><th>Month</th><th className="num">Money in</th><th className="num">Money out</th><th className="num">Kept</th></tr></thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={i}><td>{MONTH_NAMES[i]}</td><td className="num"><Money cents={m.income} /></td><td className="num"><Money cents={m.expenses} /></td><td className="num"><Money cents={m.income - m.expenses} signed /></td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="bars-wrap">
          <div className="y-axis" style={{ height: H }}>
            {ticks.slice().reverse().map((t) => <span key={t}>{short(t)}</span>)}
          </div>
          <div className="bars" style={{ height: H }} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => <div key={t} className="gridline" style={{ bottom: h(t) }} />)}
            {months.map((m, i) => (
              <button
                key={i}
                className={`month ${active === i + 1 ? 'is-active' : ''} ${selected && selected !== i + 1 ? 'is-dim' : ''}`}
                onMouseEnter={() => setHover(i + 1)}
                onFocus={() => setHover(i + 1)}
                onBlur={() => setHover(null)}
                onClick={() => onSelect(selected === i + 1 ? null : i + 1)}
                aria-label={`${MONTH_NAMES[i]}: money in ${formatUSD(m.income)}, money out ${formatUSD(m.expenses)}`}
              >
                <span className="bar in" style={{ height: h(m.income) }} />
                <span className="bar out" style={{ height: h(m.expenses) }} />
                {hover === i + 1 && (
                  <span className={`tip ${i > 8 ? 'left' : ''}`} role="tooltip">
                    <strong>{MONTH_NAMES[i]}</strong>
                    <span><i className="swatch in" /> In <Money cents={m.income} /></span>
                    <span><i className="swatch out" /> Out <Money cents={m.expenses} /></span>
                    <span className="tip-net">Kept <Money cents={m.income - m.expenses} signed /></span>
                  </span>
                )}
              </button>
            ))}
          </div>
          <div />
          <div className="x-axis">{MONTH_SHORT.map((m) => <span key={m}>{m[0]}<span className="hide-sm">{m.slice(1)}</span></span>)}</div>
        </div>
      )}
      <p className="hint no-print">Tap a month to see just that month.</p>
    </div>
  );
}

/** Horizontal bars, largest first. */
export function HBars({ items, tone = 'out' }: { items: { id: string; name: string; cents: Cents }[]; tone?: 'in' | 'out' }) {
  const max = Math.max(1, ...items.map((i) => i.cents));
  const total = items.reduce((t, i) => t + i.cents, 0);
  if (items.length === 0) return <p className="muted">Nothing here yet.</p>;
  return (
    <ul className="hbars">
      {items.map((i) => (
        <li key={i.id} title={`${i.name}: ${formatUSD(i.cents)} (${total ? Math.round((i.cents / total) * 100) : 0}%)`}>
          <div className="row between">
            <span>{i.name}</span>
            <ExpenseAmount cents={i.cents} />
          </div>
          <div className="track">
            <div className={`fill ${tone}`} style={{ width: `${Math.max(0, (i.cents / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
