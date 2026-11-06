import { vi } from 'vitest';

export const OBJECT_URL = 'blob:http://localhost/jobflow-download';

const OBJECT_URL_STATICS = {
  createObjectURL: () => OBJECT_URL,
  revokeObjectURL: () => undefined,
};

for (const [name, stub] of Object.entries(OBJECT_URL_STATICS)) {
  if (!(name in URL)) {
    Object.defineProperty(URL, name, { value: stub, configurable: true, writable: true });
  }
}

export function stubFileDownload() {
  const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue(OBJECT_URL);
  const revoked = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
  const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockReturnValue(undefined);
  return {
    blobs: () => created.mock.calls.flatMap(([source]) => (source instanceof Blob ? [source] : [])),
    revoked: () => revoked.mock.calls.map(([url]) => url),
    anchors: () =>
      clicked.mock.contexts.flatMap((anchor) =>
        anchor instanceof HTMLAnchorElement
          ? [{ href: anchor.getAttribute('href'), download: anchor.download }]
          : [],
      ),
  };
}
