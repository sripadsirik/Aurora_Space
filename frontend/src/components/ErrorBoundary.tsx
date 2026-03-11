import React from "react";

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            color: "#ff4444",
            padding: 20,
            fontFamily: "monospace",
            background: "#000"
          }}
        >
          <h2>AURORA — Render Error</h2>
          <pre>{this.state.error?.message}</pre>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
