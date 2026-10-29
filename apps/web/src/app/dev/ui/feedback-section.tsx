'use client';

import { Bell, Info } from 'lucide-react';
import { useState } from 'react';

import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/shared/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { showToast, type ToastAction, ToastCard, type ToastContent } from '@/shared/ui/toast';
import { Tooltip } from '@/shared/ui/tooltip';

import { Divider, GallerySection, Note, PANEL, Specimen, TILE_GRID } from './gallery';

const COPY = uk.devUi.feedback;

const TOASTS = COPY.toasts;

type ActionOf = (label: string) => ToastAction;

function toastSpecimens(actionOf: ActionOf): readonly ToastContent[] {
  return [
    { tone: 'success', ...TOASTS.success, action: actionOf(TOASTS.success.action) },
    { tone: 'error', ...TOASTS.error, action: actionOf(TOASTS.error.action) },
    { tone: 'info', ...TOASTS.info },
    { tone: 'undo', ...TOASTS.undo, action: actionOf(TOASTS.undo.action) },
  ];
}

function OverlaySpecimens() {
  return (
    <div className={TILE_GRID}>
      <Specimen eyebrow={COPY.tooltipEyebrow}>
        <Tooltip content={COPY.tooltip}>
          <button
            type="button"
            className="touch-target flex h-8.5 w-fit cursor-help items-center gap-2 rounded-md bg-surface-2 px-3 text-[13px] text-ink inset-ring inset-ring-line-soft"
          >
            <Info aria-hidden size={15} className="text-ink-3" />
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

function ToastSpecimens() {
  const [lastAction, setLastAction] = useState<string | null>(null);
  const actionOf: ActionOf = (label) => ({
    label,
    onAction: () => {
      setLastAction(label);
    },
  });
  return (
    <Specimen eyebrow={COPY.toastsEyebrow}>
      <div className={cn(TILE_GRID, 'items-start')}>
        {toastSpecimens(actionOf).map((content) => (
          <ToastCard key={content.tone} content={content} />
        ))}
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="w-fit"
        onClick={() => {
          showToast({
            tone: 'success',
            ...COPY.realToast,
            action: actionOf(COPY.realToast.action),
          });
        }}
      >
        {COPY.fireToast}
      </Button>
      <p role="status" className="caption text-ink-3">
        {lastAction !== null && COPY.lastAction(lastAction)}
      </p>
    </Specimen>
  );
}

function ModalSpecimen() {
  return (
    <Specimen eyebrow={COPY.modalEyebrow}>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="w-fit">
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
        <ToastSpecimens />
        <Divider />
        <ModalSpecimen />
      </div>
    </GallerySection>
  );
}
