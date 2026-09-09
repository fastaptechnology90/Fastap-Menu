import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode; page?: string };
type State = { error: Error | null };

export class RestaurantPageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[restaurant-page]", this.props.page, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="restaurant-panel flex flex-col items-center justify-center min-h-[40vh] p-8 text-center">
          <AlertTriangle className="h-9 w-9 mb-3 text-danger" aria-hidden="true" />
          <h2 className="text-lg font-semibold mb-2">This page failed to load</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-4">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
