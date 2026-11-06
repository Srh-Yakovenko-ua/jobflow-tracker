import { afterEach, describe, expect, it, vi } from 'vitest';

import { OBJECT_URL, stubFileDownload } from '@/test/file-download';

import { saveTextFile } from './save-text-file';

const ICS_FILE = {
  text: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
  fileName: 'jobflow-event.ics',
  type: 'text/calendar',
} as const;

describe('saveTextFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the text under its file name through one object URL, then revokes it', async () => {
    const download = stubFileDownload();

    saveTextFile(ICS_FILE);

    const [blob] = download.blobs();
    expect(blob?.type).toBe('text/calendar');
    expect(await blob?.text()).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    expect(download.anchors()).toEqual([{ href: OBJECT_URL, download: 'jobflow-event.ics' }]);
    await vi.waitFor(() => {
      expect(download.revoked()).toEqual([OBJECT_URL]);
    });
  });
});
