'use client';

import { Bell } from 'lucide-react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/shared/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { showToast, ToastCard, type ToastContent } from '@/shared/ui/toast';
import { Tooltip } from '@/shared/ui/tooltip';

import { Divider, GallerySection, Note, PANEL, Specimen, TILE_GRID } from './gallery';

const COPY = uk.devUi.feedback;

const NO_ACTION = () => undefined;

const TOAST_SPECIMENS: readonly ToastContent[] = [
  {
    tone: 'success',
    ...COPY.toasts.success,
    action: { label: COPY.toasts.success.action, onAction: NO_ACTION },
  },
  {
    tone: 'error',
    ...COPY.toasts.error,
    action: { label: COPY.toasts.error.action, onAction: NO_ACTION },
  },
  { tone: 'info', ...COPY.toasts.info },
];

function OverlaySpecimens() {
  return (
    <div className={TILE_GRID}>
      <Specimen eyebrow={COPY.tooltipEyebrow}>
        <Tooltip content={COPY.tooltip}>
          <button
            type="button"
            className="w-fit rounded-md bg-surface-2 px-3 py-2 text-[12.5px] font-semibold text-ink inset-ring inset-ring-line"
          >
            {COPY.tooltipTrigger}
          </button>
        </Tooltip>
        <Note>{COPY.tooltipNote}</Note>
      </Specimen>
      <Specimen eyebrow={COPY.popoverEyebrow}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" icon={<Bell aria-hidden />} className="w-fit">
              {COPY.popoverTrigger}
            </Button>
          </PopoverTrigger>
          <PopoverContent aria-label={COPY.popoverTrigger} className="flex w-73 flex-col gap-1.5">
            <p className="text-[10.5px] font-semibold tracking-[0.12em] text-ink-3 uppercase">
              {COPY.popoverTitle}
            </p>
            <p className="text-body text-ink-2">{COPY.popoverText}</p>
          </PopoverContent>
        </Popover>
      </Specimen>
    </div>
  );
}

function ModalSpecimen() {
  return (
    <Specimen eyebrow={COPY.modalEyebrow}>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="w-fit">
            {COPY.openModal}
          </Button>
        </DialogTrigger>
        <DialogContent header={COPY.modal}>
          <div className="flex justify-end gap-2.5">
            <DialogClose asChild>
              <Button variant="ghost" size="lg">
                {COPY.modal.skip}
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button size="lg">{COPY.modal.save}</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Specimen>
  );
}

export function FeedbackSection() {
  return (
    <GallerySection header={COPY}>
      <div className={PANEL}>
        <OverlaySpecimens />
        <Divider />
        <Specimen eyebrow={COPY.toastsEyebrow}>
          <div className={cn(TILE_GRID, 'items-start')}>
            {TOAST_SPECIMENS.map((content) => (
              <ToastCard key={content.tone} content={content} />
            ))}
          </div>
          <Button
            variant="ghost"
            className="w-fit"
            onClick={() => {
              showToast({
                tone: 'success',
                title: COPY.realToast.title,
                description: COPY.realToast.description,
                action: { label: COPY.realToast.action, onAction: NO_ACTION },
              });
            }}
          >
            {COPY.fireToast}
          </Button>
        </Specimen>
        <Divider />
        <ModalSpecimen />
      </div>
    </GallerySection>
  );
}
