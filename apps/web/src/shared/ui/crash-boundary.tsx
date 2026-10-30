'use client';

import { Component, type ReactNode } from 'react';

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

  static getDerivedStateFromError(thrown: unknown): CrashBoundaryState {
    const error = asIncidentError(thrown);
    return { crash: { error, incident: newIncident({ error, now: new Date() }) } };
  }

  override componentDidCatch(): void {
    if (this.state.crash) logIncident(this.state.crash);
  }

  private readonly retry = () => {
    this.props.onReset?.();
    this.setState({ crash: null });
  };

  override render() {
    const { crash } = this.state;
    if (!crash) return this.props.children;
    return <CrashPanel incident={crash.incident} view={{ scope: 'widget' }} onRetry={this.retry} />;
  }
}
