'use client';

import { Copy, Download } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { saveBlob } from '@/shared/lib/save-text-file';
import { type ShownScheme, useShownScheme } from '@/shared/lib/theme';
import { Button } from '@/shared/ui/button';
import { copyImageToClipboard } from '@/shared/ui/copy-button';
import { DialogContent, DialogFooter } from '@/shared/ui/dialog';
import { ErrorPanel } from '@/shared/ui/error-panel';
import { Fade } from '@/shared/ui/fade';
import { LoadingRegion } from '@/shared/ui/loading-region';
import { SegmentedControl } from '@/shared/ui/segmented-control';
import { SHIMMER } from '@/shared/ui/shimmer';
import { Switch } from '@/shared/ui/switch';
import { TOUCH_HEIGHT } from '@/shared/ui/touch-height';

import { SHARE_CARD_SIZE, shareCardSceneOf } from '../lib/share-card-scene';
import type { FunnelStory } from '../model/story';
import { type ShareImage, useShareImage } from '../model/use-share-image';

const COPY = uk.shareCard;

const FILE_NAME = 'jobflow-funnel.png';

const ICON = { 'aria-hidden': true, size: 16, strokeWidth: 1.9 } as const;

const FRAME =
  'aspect-[1200/630] h-auto w-full overflow-hidden rounded-md border border-line shadow-e1';

const THEME_OPTIONS = [
  { value: 'light', label: uk.theme.light },
  { value: 'dark', label: uk.theme.dark },
] as const satisfies readonly { value: ShownScheme; label: string }[];

export type ShareFunnelDialogProps = Readonly<{ story: FunnelStory }>;

type SharePreviewProps = Readonly<{ image: ShareImage; alt: string; onRetry: () => void }>;

function PreviewView({ image, alt, onRetry }: SharePreviewProps) {
  if (image.status === 'ready') {
    return <Image src={image.url} alt={alt} {...SHARE_CARD_SIZE} className={FRAME} />;
  }
  if (image.status === 'loading') {
    return <LoadingRegion className={cn(FRAME, SHIMMER)} />;
  }
  const action = (
    <Button variant="secondary" className={TOUCH_HEIGHT} onClick={onRetry}>
      {uk.states.errors.loadFailed.action}
    </Button>
  );
  return <ErrorPanel content={COPY.failed} action={action} />;
}

function SharePreview(props: SharePreviewProps) {
  const { image } = props;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <Fade key={image.status === 'ready' ? image.url : image.status}>
        <PreviewView {...props} />
      </Fade>
    </AnimatePresence>
  );
}

function ShareActions({ image }: Readonly<{ image: ShareImage }>) {
  const blob = image.status === 'ready' ? image.blob : undefined;
  return (
    <DialogFooter className="justify-end">
      <Button
        variant="secondary"
        icon={<Copy {...ICON} />}
        disabled={blob === undefined}
        onClick={() => {
          if (blob) copyImageToClipboard(blob);
        }}
      >
        {COPY.copy}
      </Button>
      <Button
        icon={<Download {...ICON} />}
        disabled={blob === undefined}
        onClick={() => {
          if (blob) saveBlob({ blob, fileName: FILE_NAME });
        }}
      >
        {COPY.download}
      </Button>
    </DialogFooter>
  );
}

function SharePanel({ story }: ShareFunnelDialogProps) {
  const shown = useShownScheme();
  const [scheme, setScheme] = useState(shown);
  const [hideNumbers, setHideNumbers] = useState(false);
  const input = { story, scheme, hideNumbers };
  const { image, retry } = useShareImage(input);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SegmentedControl
          aria-label={COPY.theme}
          options={THEME_OPTIONS}
          value={scheme}
          onValueChange={setScheme}
        />
        <Switch label={COPY.hideNumbers} checked={hideNumbers} onCheckedChange={setHideNumbers} />
      </div>
      <SharePreview image={image} alt={shareCardSceneOf(input).alt} onRetry={retry} />
      <ShareActions image={image} />
    </>
  );
}

export function ShareFunnelDialog({ story }: ShareFunnelDialogProps) {
  return (
    <DialogContent header={COPY.dialog} className="max-w-160">
      <SharePanel story={story} />
    </DialogContent>
  );
}
