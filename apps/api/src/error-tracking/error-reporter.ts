import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import * as Sentry from '@sentry/node';

import { DEPENDENCY_LIMITS } from '../common/probe.js';

export type ErrorReport = { exception: unknown; tags: Record<string, string> };

@Injectable()
export class ErrorReporter implements OnApplicationShutdown {
  capture({ exception, tags }: ErrorReport): void {
    Sentry.withScope((scope) => {
      scope.setTags(tags);
      Sentry.captureException(exception);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await Sentry.close(DEPENDENCY_LIMITS.errorReportTimeoutMs);
  }
}
