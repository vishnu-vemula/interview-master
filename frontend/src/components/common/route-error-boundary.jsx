import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

/**
 * RouteErrorBoundary — catches render errors in a page and shows a design-system fallback.
 * `home` controls where the secondary action goes (user app vs admin).
 */
export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface for developers; the UI shows a friendly fallback.
    console.error('Page crashed:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const home = this.props.home || '/';
    const homeLabel = this.props.homeLabel || 'Go home';

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-r28 border border-line-2 bg-white p-8 text-center sm:p-10">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-r14 bg-coral-bg text-coral">
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <p className="mono-label mt-6 text-coral">Unexpected error</p>
          <h1 className="mt-3 text-[30px] font-medium leading-tight tracking-tight2">This page hit a snag.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-strong">
            Your saved answers and files are safe. Reload the page, or head back and try again.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-5 max-h-40 overflow-auto rounded-r14 bg-paper p-3 text-left font-mono text-[11.5px] text-coral">
              {String(error?.message || error)}
            </pre>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-ink" onClick={() => window.location.reload()}>
              <RotateCw size={15} aria-hidden="true" /> Reload page
            </button>
            <a className="btn btn-soft" href={home}>
              {homeLabel}
            </a>
          </div>
        </div>
      </div>
    );
  }
}

/** Dev-only crash trigger used to verify the boundary (route registered only when import.meta.env.DEV). */
export function CrashTest() {
  throw new Error('Intentional test error from /__crash (development only).');
}
