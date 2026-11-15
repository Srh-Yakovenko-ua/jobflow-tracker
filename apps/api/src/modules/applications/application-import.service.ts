import {
  type ImportApplicationsInput,
  type ImportApplicationsResponse,
  type ImportRowError,
  importRowSchemaAt,
} from '@jobflow/shared';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod';

import { conflict } from '../../common/app-error.js';
import { Clock } from '../../common/clock.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { APPLICATION_EVENTS } from './applications.events.js';
import { ApplicationsRepository } from './applications.repository.js';
import { importedApplicationOf, type RowOutcome } from './imported-application.js';

type RowSchema = ReturnType<typeof importRowSchemaAt>;

function outcomeOf(parsed: z.ZodSafeParseResult<z.output<RowSchema>>): RowOutcome {
  if (parsed.success) {
    return importedApplicationOf(parsed.data);
  }
  return {
    issues: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
  };
}

const errorsOf = (outcomes: RowOutcome[]): ImportRowError[] =>
  outcomes.flatMap((outcome, row) =>
    'issues' in outcome ? outcome.issues.map((issue) => ({ row, ...issue })) : [],
  );

@Injectable()
export class ApplicationImportService {
  constructor(
    private readonly applications: ApplicationsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async importRows(
    userId: string,
    { rows }: ImportApplicationsInput,
  ): Promise<ImportApplicationsResponse> {
    const rowSchema = importRowSchemaAt(this.clock.now());
    const outcomes = rows.map((row) => outcomeOf(rowSchema.safeParse(row)));
    const applications = outcomes.flatMap((outcome) =>
      'application' in outcome ? [outcome.application] : [],
    );
    await this.prisma.$transaction(async (tx) => {
      const { searchId } = await this.applications.findCreateDefaults(userId, { tx });
      if (searchId === null) {
        throw conflict('No active search');
      }
      const ids = await this.applications.insertMany(userId, { searchId, applications, tx });
      const events = ids.map((applicationId) => ({
        eventType: APPLICATION_EVENTS.created,
        applicationId,
      }));
      await this.applications.recordEvents(userId, { events, tx });
    });
    return { imported: applications.length, errors: errorsOf(outcomes) };
  }
}
