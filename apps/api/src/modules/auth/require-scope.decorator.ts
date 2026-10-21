import type { TokenScope } from '@jobflow/shared';
import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPE = 'requiredScope';

export const DEFAULT_SCOPE: TokenScope = 'user';

export const RequireScope = (scope: TokenScope) => SetMetadata(REQUIRED_SCOPE, scope);
