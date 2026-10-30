'use client';

import { Component, createRef, type ReactNode } from 'react';

import {
  type IncidentError,
  logIncident,
  type LogIncidentInput,
  newIncident,
} from '@/shared/lib/incident';

import { CrashPanel } from './crash-panel';

export type CrashBoundaryProps = Readonly<{ children: ReactNode; onReset?: () => void }>;

type CrashBoundaryState = { crash: LogIncidentInput | null };

function asIncidentError(thrown: unknown): IncidentError {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}

export class CrashBoundary extends Component<CrashBoundaryProps, CrashBoundaryState> {
  override state: CrashBoundaryState = { crash: null };

  private readonly region = createRef<HTMLDivElement>();

  static getDerivedStateFromError(thrown: unknown): CrashBoundaryState {
    const error = asIncidentError(thrown);
    return { crash: { error, incident: newIncident({ error, now: new Date() }) } };
  }

  override componentDidCatch(): void {
    if (this.state.crash) logIncident(this.state.crash);
  }

  override componentDidUpdate(_: CrashBoundaryProps, previous: CrashBoundaryState): void {
    if (previous.crash && !this.state.crash) this.region.current?.focus();
  }

  private readonly retry = () => {
    this.props.onReset?.();
    this.setState({ crash: null });
  };

  override render() {
    const { crash } = this.state;
    return (
      <div ref={this.region} tabIndex={-1} className="min-w-0">
        {crash ? (
          <CrashPanel incident={crash.incident} view={{ scope: 'widget' }} onRetry={this.retry} />
        ) : (
          this.props.children
        )}
      </div>
    );
  }
}
