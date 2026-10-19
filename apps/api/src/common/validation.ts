import type { StandardSchemaValidationPipeOptions } from '@nestjs/common';

import { type AppError, validation } from './app-error.js';

type SchemaIssues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0];

type SchemaIssue = SchemaIssues[number];

function joinPath(issue: SchemaIssue): string {
  return (issue.path ?? [])
    .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
    .join('.');
}

export function toValidationError(issues: SchemaIssues): AppError {
  return validation(issues.map((issue) => ({ path: joinPath(issue), message: issue.message })));
}
