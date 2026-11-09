import { useStore } from '../store';
import { removeSampleData } from '../lib/ops';
import { businessExpenses, categoryTotals, inPeriod, monthlyTotals, summarize, yearsWithData } from '../lib/totals';
import { HBars, MonthlyChart, PeriodPicker, StatCard, periodLabel, Confirm } from '../ui/components';
import { useState } from 'react';

export default function Home() {
  const { state, update, period, setPeriod } = useStore();
  const [confirmClear, setConfirmClear] = useState(false);
  const years = yearsWithData(state, new Date().getFullYear());
  const s = summarize(state, period);
  const months = monthlyTotals(state, period.year);
  const cats = categoryTotals(
    businessExpenses(state.expenses).filter((e) => inPeriod(e.date, period)),
    state.categories,
  ).map((c) => ({ id: c.categoryId, name: c.name, cents: c.cents }));
  const hasSample = state.income.some((i) => i.sample) || state.expenses.some((e) => e.sample);

  return (
    <>
      {hasSample && (
        <div className="banner">
          <p>You’re looking at <strong>sample numbers</strong> so you can see how things work.</p>
          <button className="btn" onClick={() => setConfirmClear(true)}>Remove sample data</button>
        </div>
      )}
      <div className="row between wrap">
        <h1>{periodLabel(period)} at a glance</h1>
        <PeriodPicker period={period} setPeriod={setPeriod} years={years} />
      </div>

      <section className="stats">
        <StatCard label="Money in" formal="Total income" cents={s.income} tone="in" />
        <StatCard label="Money out" formal="Business expenses" cents={s.expenses} tone="out" />
        <StatCard label="What you kept" formal="Net profit" cents={s.net} tone="net" signed />
      </section>

      <section className="card">
        <h2>Month by month, {period.year}</h2>
        <MonthlyChart months={months} selected={period.month} onSelect={(m) => setPeriod({ ...period, month: m })} />
      </section>

      <section className="card">
        <h2>Where the money went</h2>
        <p className="sub">Business expenses by category, {periodLabel(period)}</p>
        <HBars items={cats} />
      </section>

      <Confirm
        open={confirmClear}
        title="Remove the sample data?"
        body="This removes only the made-up example entries. Anything you added yourself stays."
        confirmLabel="Remove sample data"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          update(removeSampleData);
          setConfirmClear(false);
        }}
      />
    </>
  );
}
