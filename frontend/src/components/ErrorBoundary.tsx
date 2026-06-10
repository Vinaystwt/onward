import { Component, ReactNode } from "react";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null; info: string | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // eslint-disable-next-line no-console
    console.error("[Onward] render crash", this.props.label ?? "unlabelled", error, info);
    this.setState({ error, info: info.componentStack ?? null });
  }
  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="card p-8">
          <span className="pill pill-rose mb-3">Render error</span>
          <h2 className="font-display text-2xl tracking-tight mb-2">
            {this.props.label ? `${this.props.label} failed to render.` : "Something failed to render."}
          </h2>
          <p className="text-ink-muted mb-4">
            Caught at a boundary. The rest of the app keeps working. Reload to retry.
          </p>
          <pre className="num text-xs bg-paper-warm/70 border border-ink/5 rounded-2xl p-4 overflow-x-auto whitespace-pre-wrap">
{`${this.state.error.name}: ${this.state.error.message}

${this.state.info ?? this.state.error.stack ?? ""}`.slice(0, 4000)}
          </pre>
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={() => location.reload()}>Reload</button>
            <button className="btn-ghost" onClick={this.reset}>Try again</button>
          </div>
        </div>
      </div>
    );
  }
}
