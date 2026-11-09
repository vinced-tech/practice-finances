import { useEffect, useState } from 'react';
import Home from './screens/Home';
import IncomeScreen from './screens/IncomeScreen';
import ExpensesScreen from './screens/ExpensesScreen';
import TaxScreen from './screens/TaxScreen';
import MoreScreen from './screens/MoreScreen';
import { useStore } from './store';

const TABS = [
  { id: 'home', label: 'Home', icon: '◉' },
  { id: 'in', label: 'Money in', icon: '↓' },
  { id: 'out', label: 'Money out', icon: '↑' },
  { id: 'taxes', label: 'Taxes', icon: '▤' },
  { id: 'more', label: 'More', icon: '⋯' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const fromHash = (): Tab => {
  const h = window.location.hash.replace('#/', '').split('/')[0];
  return (TABS.find((t) => t.id === h)?.id ?? 'home') as Tab;
};

export default function App() {
  const [tab, setTab] = useState<Tab>(fromHash);
  const { saveError } = useStore();

  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0); // (newer browsers return a Promise here — must not be returned to React)
  }, [tab]);

  return (
    <div className="app">
      <header className="topbar no-print">
        <span className="brand">Practice Finances</span>
        <nav className="tabs" aria-label="Main">
          {TABS.map((t) => (
            <a key={t.id} href={`#/${t.id}`} className={tab === t.id ? 'tab active' : 'tab'} aria-current={tab === t.id ? 'page' : undefined}>
              <span className="tab-icon" aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
            </a>
          ))}
        </nav>
      </header>
      {saveError && <p className="alert page">{saveError}</p>}
      <main className="page">
        {tab === 'home' && <Home />}
        {tab === 'in' && <IncomeScreen />}
        {tab === 'out' && <ExpensesScreen />}
        {tab === 'taxes' && <TaxScreen />}
        {tab === 'more' && <MoreScreen />}
      </main>
    </div>
  );
}
