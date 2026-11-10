import {
  type ArgumentMetadata,
  Injectable,
  StandardSchemaValidationPipe,
  type StandardSchemaValidationPipeOptions,
} from '@nestjs/common';

import { type AppError, validation } from './app-error.js';

type SchemaIssues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0];

type SchemaIssue = SchemaIssues[number];

function joinPath(issue: SchemaIssue, parameter?: string): string {
  const segments = (issue.path ?? []).map((segment) =>
    String(typeof segment === 'object' ? segment.key : segment),
  );
  return (parameter === undefined ? segments : [parameter, ...segments]).join('.');
}

export function toValidationError(issues: SchemaIssues, parameter?: string): AppError {
  return validation(
    issues.map((issue) => ({ path: joinPath(issue, parameter), message: issue.message })),
  );
}

@Injectable()
export class SchemaValidationPipe extends StandardSchemaValidationPipe {
  override async transform<T>(value: T, metadata: ArgumentMetadata): Promise<T> {
    const { schema, data } = metadata;
    if (!schema || !this.toValidate(metadata)) return value;
    this.stripProtoKeys(value);
    const result = await this.validate<T>(value, schema, this.validateOptions);
    if (result.issues) throw toValidationError(result.issues, data);
    return result.value;
  }
}
