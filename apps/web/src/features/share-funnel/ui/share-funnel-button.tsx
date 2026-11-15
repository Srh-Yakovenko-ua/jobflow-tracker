'use client';

import { Share2 } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogTrigger } from '@/shared/ui/dialog';

import type { FunnelStory } from '../model/story';
import { ShareFunnelDialog } from './share-funnel-dialog';

export type ShareFunnelButtonProps = Readonly<{ story: FunnelStory }>;

export function ShareFunnelButton({ story }: ShareFunnelButtonProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className="animate-fade-in"
          icon={<Share2 aria-hidden size={16} strokeWidth={1.9} />}
        >
          {uk.shareCard.button}
        </Button>
      </DialogTrigger>
      <ShareFunnelDialog story={story} />
    </Dialog>
  );
}
