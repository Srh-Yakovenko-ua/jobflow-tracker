import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT = 'idempotent';

export const Idempotent = () => SetMetadata(IDEMPOTENT, true);
