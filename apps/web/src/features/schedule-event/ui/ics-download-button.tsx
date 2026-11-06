'use client';

import type { ScheduledEvent } from '@jobflow/shared';
import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { scheduledEventIcs } from '@/entities/scheduled-event';
import { uk } from '@/shared/i18n';
import { saveTextFile } from '@/shared/lib/save-text-file';
import { Button } from '@/shared/ui/button';
import { showErrorToast } from '@/shared/ui/error-toast';

export type IcsDownloadButtonProps = Readonly<{ event: ScheduledEvent }>;

const ICS_FILE = { fileName: 'jobflow-event.ics', type: 'text/calendar' } as const;

export function IcsDownloadButton({ event }: IcsDownloadButtonProps) {
  const download = useMutation({
    mutationFn: () => scheduledEventIcs({ applicationId: event.applicationId, eventId: event.id }),
    onSuccess: (text) => {
      saveTextFile({ text, ...ICS_FILE });
    },
    onError: () => {
      showErrorToast(uk.applicationPage.schedule.downloadFailed);
    },
  });
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={download.isPending}
      icon={<Download aria-hidden size={16} strokeWidth={1.9} />}
      onClick={() => {
        download.mutate();
      }}
    >
      {uk.applicationPage.schedule.downloadIcs}
    </Button>
  );
}
