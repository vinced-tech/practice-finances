import { useStore } from '../store';
import { taxReport, taxReportCSV } from '../lib/tax';
import { yearsWithData } from '../lib/totals';
import { download, ExpenseAmount, Money, PeriodPicker } from '../ui/components';

const QUARTER_MONTHS = ['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'];

export default function TaxScreen() {
  const { state, period, setPeriod } = useStore();
  const year = period.year;
  const r = taxReport(state, year);
  const years = yearsWithData(state, new Date().getFullYear());

  return (
    <div className="tax">
      <div className="row between wrap">
        <div>
          <h1>Tax summary {year}</h1>
          <p className="sub">Business only — for you and your accountant</p>
        </div>
        <div className="row gap wrap no-print">
          <button className="btn" onClick={() => download(`tax-summary-${year}.csv`, taxReportCSV(state, year), 'text/csv')}>Download CSV</button>
          <button className="btn primary big" onClick={() => window.print()}>Print / save as PDF</button>
        </div>
      </div>
      <PeriodPicker period={{ year, month: null }} setPeriod={(p) => setPeriod({ year: p.year, month: null })} years={years} allowMonth={false} />

      <section className="card">
        <table className="table">
          <tbody>
            <tr><td>Money in <span className="muted small">· Total income</span></td><td className="num in-ink strong"><Money cents={r.summary.income} /></td></tr>
            <tr><td>Money out <span className="muted small">· Business expenses</span></td><td className="num out-ink strong"><Money cents={r.summary.expenses} /></td></tr>
            <tr className="total"><td>What you kept <span className="muted small">· Net profit</span></td><td className="num strong"><Money cents={r.summary.net} signed /></td></tr>
          </tbody>
        </table>
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Income by source</h2>
          <table className="table">
            <tbody>
              {r.bySource.map((s) => <tr key={s.sourceId}><td>{s.name}</td><td className="num"><Money cents={s.cents} /></td></tr>)}
              {r.bySource.length === 0 && <tr><td className="muted">No income recorded.</td></tr>}
            </tbody>
            <tfoot><tr><td>Total</td><td className="num"><Money cents={r.summary.income} /></td></tr></tfoot>
          </table>
        </section>

        <section className="card">
          <h2>Business expenses by category</h2>
          <table className="table">
            <tbody>
              {r.byCategory.map((c) => <tr key={c.categoryId}><td>{c.name}</td><td className="num"><ExpenseAmount cents={c.cents} /></td></tr>)}
              {r.byCategory.length === 0 && <tr><td className="muted">No business expenses recorded.</td></tr>}
            </tbody>
            <tfoot><tr><td>Total</td><td className="num"><Money cents={r.summary.expenses} /></td></tr></tfoot>
          </table>
        </section>
      </div>

      <section className="card">
        <h2>By quarter</h2>
        <p className="sub">Helpful for estimated tax payments</p>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Quarter</th><th className="num">Money in</th><th className="num">Money out</th><th className="num">Kept</th></tr></thead>
            <tbody>
              {r.quarters.map((q, i) => (
                <tr key={i}>
                  <td>Q{i + 1} <span className="muted small">{QUARTER_MONTHS[i]}</span></td>
                  <td className="num"><Money cents={q.income} /></td>
                  <td className="num"><Money cents={q.expenses} /></td>
                  <td className="num"><Money cents={q.net} signed /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">These are calendar quarters. The IRS estimated-payment periods are slightly different (Jan–Mar, Apr–May, Jun–Aug, Sep–Dec; due Apr 15, Jun 15, Sep 15 and Jan 15). Your accountant can adjust.</p>
      </section>

      <p className="note">
        Personal items (<Money cents={r.personalTotal} /> in {year}) are <strong>not</strong> included anywhere on this page.
        You can review them under Money out → Personal.
      </p>
      <p className="hint print-only">Prepared {new Date().toLocaleDateString()} from Practice Finances. All amounts in US dollars.</p>
    </div>
  );
}
