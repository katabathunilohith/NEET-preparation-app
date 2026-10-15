import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="onboard card">
        <h1>Something went wrong</h1>
        <p className="muted">Your progress is safe on this device. Try reloading the page.</p>
        <pre className="tiny muted" style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
        <button className="btn primary" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
