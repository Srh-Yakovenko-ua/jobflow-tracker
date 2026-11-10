export const SETTINGS_ANCHORS = { bookmarklet: 'bookmarklet' } as const;

export type SettingsAnchor = (typeof SETTINGS_ANCHORS)[keyof typeof SETTINGS_ANCHORS];

export function settingsHref(anchor: SettingsAnchor): string {
  return `/settings#${anchor}`;
}
