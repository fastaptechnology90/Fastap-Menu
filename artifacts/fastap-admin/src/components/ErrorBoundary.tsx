import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Stops one broken component from blanking the whole application.
 *
 * Without this, a single unexpected value anywhere in the tree — one malformed
 * amount, one missing field — throws during render and React unmounts
 * everything, leaving a white screen with no explanation (see BUG.md #23).
 *
 * Wrap each routed page so a failure stays contained to that page and the user
 * keeps their navigation, session and a way out.
 */
interface Props {
  children: ReactNode;
  /** Shown instead of the default panel. */
  fallback?: ReactNode;
  /** Helps identify the failing area in logs. */
  name?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold">This section could not be displayed</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Something in {this.props.name ?? "this page"} failed to load. The rest of the
            application is unaffected — you can retry or move to another page.
          </p>
          <pre className="mb-4 overflow-x-auto rounded bg-muted p-3 text-left text-xs">
            {error.message}
          </pre>
          <div className="flex justify-center gap-2">
            <button
              onClick={this.reset}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border px-4 py-2 text-sm font-medium"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
