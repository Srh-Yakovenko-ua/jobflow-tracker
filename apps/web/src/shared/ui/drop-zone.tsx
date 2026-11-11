'use client';

import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  type RefObject,
  useRef,
  useState,
} from 'react';

import { cn } from '@/shared/lib/cn';

import { buttonLinkClasses } from './button';

const ZONE =
  'border-[1.5px] border-dashed border-line bg-surface-2 transition-[border-color,background-color,box-shadow] duration-(--duration-base) ease-standard data-dragging:border-accent data-dragging:bg-accent-tint data-dragging:ring-4 data-dragging:ring-accent/25';

const PICKER = cn(
  buttonLinkClasses({ variant: 'secondary', size: 'sm' }),
  'cursor-pointer has-focus-visible:focus-ring',
);

export type FilePicker = Readonly<{
  inputRef: RefObject<HTMLInputElement | null>;
  open: () => void;
}>;

export type DropZonePicker = {
  label: string;
  accept: string;
  inputRef?: FilePicker['inputRef'];
};

export function useFilePicker(): FilePicker {
  const inputRef = useRef<HTMLInputElement>(null);
  return {
    inputRef,
    open: () => {
      inputRef.current?.click();
    },
  };
}

export type DropZoneProps = Readonly<{
  picker: DropZonePicker;
  onFile: (file: File) => void;
  children: ReactNode;
  className?: string;
}>;

function carriesFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes('Files');
}

function useFileDrag(onFile: DropZoneProps['onFile']) {
  const depthRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const enter = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depthRef.current += 1;
    setDragging(true);
  };
  const over = (event: DragEvent) => {
    if (carriesFiles(event)) event.preventDefault();
  };
  const leave = () => {
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setDragging(false);
  };
  const drop = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depthRef.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file !== undefined) onFile(file);
  };
  return {
    dragging,
    handlers: { onDragEnter: enter, onDragOver: over, onDragLeave: leave, onDrop: drop },
  };
}

export function DropZone({
  picker: { label, accept, inputRef },
  onFile,
  children,
  className,
}: DropZoneProps) {
  const drag = useFileDrag(onFile);
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file !== undefined) onFile(file);
  };
  return (
    <div
      {...drag.handlers}
      data-dragging={drag.dragging || undefined}
      className={cn(ZONE, className)}
    >
      {children}
      <label className={PICKER}>
        <input ref={inputRef} type="file" accept={accept} onChange={pick} className="sr-only" />
        {label}
      </label>
    </div>
  );
}
