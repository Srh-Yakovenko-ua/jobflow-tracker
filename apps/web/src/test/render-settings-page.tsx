import { screen } from '@testing-library/react';

import { userKeys } from '@/entities/user';
import { SettingsPage } from '@/widgets/settings-page';

import { QueryProbe, waitForQuery } from './query-status';
import { renderInApp } from './render-in-app';
import { server } from './server';
import { settingsRoutes, type SettingsRoutesOptions } from './settings-fixtures';

export const SUGGESTIONS_KEY = userKeys.settingsSuggestions();

export function renderSettingsPage(options: SettingsRoutesOptions = {}) {
  const routes = settingsRoutes(options);
  server.use(...routes.handlers);
  const user = renderInApp(
    <>
      <SettingsPage />
      <QueryProbe queryKey={userKeys.me()} />
      <QueryProbe queryKey={SUGGESTIONS_KEY} />
    </>,
  );
  return { user, routes };
}

export async function renderLoadedSettings(options: SettingsRoutesOptions = {}) {
  const page = renderSettingsPage(options);
  await waitForQuery({ queryKey: userKeys.me(), status: 'success' });
  return page;
}

export function regionOf(name: string) {
  return screen.getByRole('region', { name });
}
