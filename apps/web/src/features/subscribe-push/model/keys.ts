export const pushKeys = {
  all: ['push'] as const,
  publicKey: () => [...pushKeys.all, 'public-key'] as const,
  browserSubscribed: () => [...pushKeys.all, 'browser-subscribed'] as const,
};
