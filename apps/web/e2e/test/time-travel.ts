import { execFileSync } from 'node:child_process';

import { type ApplicationResponse, userSettingsSchema } from '@jobflow/shared';
import type { APIRequestContext } from '@playwright/test';

import { type E2eUser, expect, loginToken } from './session';
import { apiUrl, databaseName, REPO_ROOT } from './stack';

export type SilenceTrip = Readonly<{
  request: APIRequestContext;
  user: E2eUser;
  applicationId: ApplicationResponse['id'];
}>;

const BACKDATE_SQL =
  "UPDATE applications SET last_event_at = now() - make_interval(days => :days) WHERE id = :'id';";

function backdate({ applicationId, days }: Readonly<{ applicationId: string; days: number }>) {
  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      databaseName(),
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      `id=${applicationId}`,
      '-v',
      `days=${String(days)}`,
    ],
    { cwd: REPO_ROOT, input: BACKDATE_SQL },
  );
}

export async function makeSilent({ request, user, applicationId }: SilenceTrip): Promise<void> {
  const headers = { Authorization: `Bearer ${await loginToken(request, user)}` };
  const settings = await request.get(apiUrl('/settings'), { headers });
  const { silenceDays } = userSettingsSchema.parse(await settings.json());
  backdate({ applicationId, days: silenceDays + 1 });
  const scan = await request.post(apiUrl('/dev/jobs/silence-scan'), { headers });
  expect(scan.status()).toBe(202);
}
