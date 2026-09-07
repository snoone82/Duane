"use client";

import { Component, type ReactNode } from "react";

/** Duane: one bad Master Content item should be flagged, not take the whole
 * plan page down. Wraps a single row; a render error inside it becomes an
 * inline notice naming the item, and every other row still renders. */
export class RowErrorBoundary extends Component<{ label: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm">
          <p className="font-medium text-danger">Couldn&rsquo;t display {this.props.label}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            The rest of the plan is unaffected. Technical detail: {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
