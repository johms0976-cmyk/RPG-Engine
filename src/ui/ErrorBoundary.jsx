/* ============================================================
   ERROR BOUNDARY — one bad module should not be a white screen.
   ============================================================ */
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("Engine error:", error, info);
  }
  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    const mod = this.props.mod;
    return (
      <div className="center-screen">
        <div className="panel dark" style={{ maxWidth: 640 }}>
          <header><h2>The cartridge stopped</h2></header>
          <div className="body stack">
            <p style={{ margin: 0 }}>
              Something in {mod ? mod.title : "the module"} threw an error and the player caught it
              instead of dying. Your last autosave is intact.
            </p>
            <pre style={{ fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "pre-wrap",
              background: "var(--void2)", padding: 10, maxHeight: 200, overflow: "auto", margin: 0 }}>
              {String(error && error.message || error)}
            </pre>
            {mod && mod.problems && mod.problems.length > 0 && (
              <>
                <div className="label">MODULE PROBLEMS</div>
                <ul style={{ fontFamily: "var(--mono)", fontSize: 11, margin: 0, paddingLeft: 18 }}>
                  {mod.problems.slice(0, 12).map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </>
            )}
            <div className="btn-row">
              <button className="btn ghost inline" onClick={() => this.setState({ error: null, info: null })}>Try again</button>
              {this.props.onEject && (
                <button className="btn ghost inline" onClick={this.props.onEject}>Back to the library</button>
              )}
            </div>
            {info && info.componentStack && (
              <details>
                <summary style={{ fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer" }}>Stack</summary>
                <pre style={{ fontFamily: "var(--mono)", fontSize: 10, whiteSpace: "pre-wrap", margin: "6px 0 0" }}>
                  {info.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  }
}
