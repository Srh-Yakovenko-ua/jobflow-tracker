import type { ErrorReport, ErrorReporter } from '../error-tracking/error-reporter.js';

export class RecordingErrorReporter implements Pick<ErrorReporter, 'capture'> {
  readonly reports: ErrorReport[] = [];

  capture(report: ErrorReport): void {
    this.reports.push(report);
  }
}
