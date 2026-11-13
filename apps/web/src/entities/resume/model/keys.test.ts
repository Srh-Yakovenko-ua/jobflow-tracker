import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { resumeKeys } from './keys';

describe('resumeKeys', () => {
  it('invalidating the versions list, as a relink does, also invalidates the CV conversions', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(resumeKeys.ab(), {});

    await queryClient.invalidateQueries({ queryKey: resumeKeys.list() });

    expect(queryClient.getQueryState(resumeKeys.ab())?.isInvalidated).toBe(true);
  });
});
