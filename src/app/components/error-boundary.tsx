import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[PageErrorBoundary] Uncaught error:", error.message);
    console.error("[PageErrorBoundary] Component stack:", info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
          <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg className="size-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium">
              {this.props.fallbackTitle || "Something went wrong"}
            </h3>
            <p className="text-[11px] text-muted-foreground max-w-sm">
              An unexpected error occurred. You can try again or navigate to a different page.
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="mt-2 px-3 py-1.5 text-[11px] font-medium rounded border hover:bg-muted/40 transition-colors"
          >
            Try Again
          </button>
          {process.env.NODE_ENV !== "production" && this.state.error && (
            <details className="mt-3 text-left w-full max-w-md">
              <summary className="text-[9px] text-muted-foreground cursor-pointer">Technical details</summary>
              <pre className="mt-1 text-[8px] text-destructive bg-destructive/5 rounded p-2 overflow-auto max-h-32 font-mono">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack?.split("\n").slice(1, 5).join("\n")}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
