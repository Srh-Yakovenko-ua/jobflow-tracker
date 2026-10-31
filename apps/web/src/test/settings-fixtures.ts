import {
  type MeResponse,
  updateUserSettingsInputSchema,
  type UserSettings,
  userSettingsSchema,
} from '@jobflow/shared';
import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

import { apiUrl, SUGGESTIONS, SUGGESTIONS_REQUEST } from './api-handlers';
import { heldReply, type MoveRouteOptions } from './board-fixtures';
import { meRoute, meWithSettings } from './session-fixtures';

export const SETTINGS_URL = apiUrl('/settings');

const SUGGESTIONS_URL = apiUrl(SUGGESTIONS_REQUEST.path);

export type SettingsRoutesOptions = {
  settings?: Partial<UserSettings>;
  patch?: MoveRouteOptions;
  suggestions?: HttpResponseResolver;
  me?: HttpResponseResolver;
};

export function settingsRoutes({
  settings = {},
  patch = {},
  suggestions = () => HttpResponse.json(SUGGESTIONS),
  me,
}: SettingsRoutesOptions = {}) {
  const store: { me: MeResponse } = { me: meWithSettings(settings) };
  const patches: unknown[] = [];
  const saved = (body: unknown) => {
    const changes = updateUserSettingsInputSchema.parse(body);
    store.me = {
      ...store.me,
      settings: userSettingsSchema.parse({ ...store.me.settings, ...changes }),
    };
    return HttpResponse.json(store.me.settings);
  };
  const handlers = [
    meRoute(me ?? (() => HttpResponse.json(store.me))),
    http.patch(SETTINGS_URL, async (info) => {
      const body: unknown = await info.request.json();
      patches.push(body);
      return heldReply({ ...patch, info, fallback: () => saved(body) });
    }),
    http.get(SUGGESTIONS_URL, suggestions),
  ];
  return { handlers, patches, store };
}
