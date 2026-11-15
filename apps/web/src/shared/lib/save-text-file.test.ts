import { afterEach, describe, expect, it, vi } from 'vitest';

import { OBJECT_URL, stubFileDownload } from '@/test/file-download';

import { saveBlob, saveTextFile } from './save-text-file';

const ICS_FILE = {
  text: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
  fileName: 'jobflow-event.ics',
  type: 'text/calendar',
} as const;

type FileDownload = ReturnType<typeof stubFileDownload>;

async function expectOneDownload(download: FileDownload, fileName: string) {
  expect(download.anchors()).toEqual([{ href: OBJECT_URL, download: fileName }]);
  await vi.waitFor(() => {
    expect(download.revoked()).toEqual([OBJECT_URL]);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saveTextFile', () => {
  it('downloads the text under its file name through one object URL, then revokes it', async () => {
    const download = stubFileDownload();

    saveTextFile(ICS_FILE);

    const [blob] = download.blobs();
    expect(blob?.type).toBe('text/calendar');
    expect(await blob?.text()).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    await expectOneDownload(download, 'jobflow-event.ics');
  });
});

describe('saveBlob', () => {
  it('downloads the given image blob itself under its file name, then revokes the URL', async () => {
    const download = stubFileDownload();
    const image = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

    saveBlob({ blob: image, fileName: 'jobflow-funnel.png' });

    expect(download.blobs()).toHaveLength(1);
    expect(download.blobs()[0]).toBe(image);
    await expectOneDownload(download, 'jobflow-funnel.png');
  });
});
