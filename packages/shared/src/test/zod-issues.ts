import type { z } from 'zod';

export const issuePathsOf = ({ error }: { error?: z.ZodError | undefined }) =>
  error?.issues.map(({ path }) => path.join('.')) ?? [];
