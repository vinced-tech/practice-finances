import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { StoreProvider } from './store';
import './styles.css';

/** If something unexpected breaks, show a calm message instead of a blank page. Data is untouched. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page">
        <h1>Something went wrong on this screen</h1>
        <p className="sub">Your saved data is safe. Reloading usually fixes it.</p>
        <button className="btn primary" onClick={() => { window.location.hash = '#/home'; window.location.reload(); }}>Reload</button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
);
