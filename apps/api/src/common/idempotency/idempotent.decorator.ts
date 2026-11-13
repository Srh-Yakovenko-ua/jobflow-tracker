import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT = 'idempotent';

export type IdempotentOptions = { keyRequired?: boolean };

export const Idempotent = (options: IdempotentOptions = {}) => SetMetadata(IDEMPOTENT, options);
