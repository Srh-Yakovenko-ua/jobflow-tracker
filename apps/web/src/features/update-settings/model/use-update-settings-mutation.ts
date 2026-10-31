import { type MeResponse, type UpdateUserSettingsInput, userSettingsSchema } from '@jobflow/shared';
import {
  type MutationStatus,
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { z } from 'zod';

import { applicationKeys } from '@/entities/application';
import { userKeys } from '@/entities/user';
import { uk } from '@/shared/i18n';
import { showErrorToast } from '@/shared/ui/error-toast';

import { updateSettings } from '../api/update-settings';

export type SettingsSave = Readonly<{
  save: (patch: UpdateUserSettingsInput) => void;
  status: MutationStatus;
}>;

const SETTINGS_SCOPE = { id: 'user-settings' };

const SETTINGS_MUTATION_KEY = [SETTINGS_SCOPE.id];

const settingsFieldsSchema = userSettingsSchema.partial();

const pendingChangeSchema = z.object({ patch: z.record(z.string(), z.unknown()) });

type SettingsFields = z.infer<typeof settingsFieldsSchema>;

type SettingsChange = { patch: UpdateUserSettingsInput; previous: SettingsFields | undefined };

type SettledChange = { source: SettingsFields; change: SettingsChange };

function fieldsOf(source: SettingsFields, keep: (field: string) => boolean): SettingsFields {
  const kept = Object.entries(source).filter(([field]) => keep(field));
  return settingsFieldsSchema.parse(Object.fromEntries(kept));
}

function withFields(me: MeResponse, fields: SettingsFields): MeResponse {
  return { ...me, settings: userSettingsSchema.parse({ ...me.settings, ...fields }) };
}

function laterFieldsOf(queryClient: QueryClient, change: SettingsChange): Set<string> {
  const pending = queryClient
    .getMutationCache()
    .findAll({ mutationKey: SETTINGS_MUTATION_KEY, status: 'pending' });
  const later = pending.filter(({ state }) => state.variables !== change);
  return new Set(
    later.flatMap(({ state }) => Object.keys(pendingChangeSchema.parse(state.variables).patch)),
  );
}

function patchMe(queryClient: QueryClient, fields: SettingsFields) {
  queryClient.setQueryData<MeResponse>(userKeys.me(), (me) => me && withFields(me, fields));
}

function settle(queryClient: QueryClient, { source, change }: SettledChange) {
  const later = laterFieldsOf(queryClient, change);
  patchMe(
    queryClient,
    fieldsOf(source, (field) => field in change.patch && !later.has(field)),
  );
}

export function useUpdateSettingsMutation(): SettingsSave {
  const queryClient = useQueryClient();
  const meKey = userKeys.me();
  const { mutate, status } = useMutation({
    mutationKey: SETTINGS_MUTATION_KEY,
    mutationFn: ({ patch }: SettingsChange) => updateSettings(patch),
    scope: SETTINGS_SCOPE,
    onMutate: async ({ patch }) => {
      await queryClient.cancelQueries({ queryKey: meKey });
      patchMe(queryClient, patch);
    },
    onSuccess: (settings, change) => {
      settle(queryClient, { source: settings, change });
      if ('silenceDays' in change.patch) {
        void queryClient.invalidateQueries({ queryKey: applicationKeys.all });
      }
    },
    onError: (_error, change) => {
      if (change.previous) settle(queryClient, { source: change.previous, change });
      showErrorToast(uk.settings.saveFailed);
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: SETTINGS_MUTATION_KEY }) === 1) {
        void queryClient.invalidateQueries({ queryKey: meKey });
      }
    },
  });
  return {
    save: (patch) => {
      const me = queryClient.getQueryData<MeResponse>(meKey);
      mutate({ patch, previous: me && fieldsOf(me.settings, (field) => field in patch) });
    },
    status,
  };
}
