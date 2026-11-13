import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DropZone, type DropZonePicker } from './drop-zone';

const PICKER = { label: 'Обрати файл', accept: '.pdf,application/pdf' } as const;

const RESUME = new File(['%PDF-1.7'], 'andrii_cv.pdf', { type: 'application/pdf' });

const SECOND = new File(['%PDF-1.7'], 'andrii_cv_v2.pdf', { type: 'application/pdf' });

function renderZone(picker: DropZonePicker = PICKER) {
  const onFile = vi.fn<(file: File) => void>();
  render(
    <DropZone picker={picker} onFile={onFile}>
      <p>Перетягни PDF або DOCX сюди</p>
    </DropZone>,
  );
  const zone = screen.getByText('Перетягни PDF або DOCX сюди').parentElement;
  if (zone === null) throw new Error('the drop zone has no box');
  return { onFile, zone, picker: screen.getByLabelText<HTMLInputElement>(PICKER.label) };
}

function fileDrag(files: readonly File[]) {
  return { dataTransfer: { files, types: ['Files'] } };
}

describe('DropZone', () => {
  it('the picker is reached by Tab, keeps the accept list and the touch target, and hands back the picked file', async () => {
    const user = userEvent.setup();
    const { onFile, picker } = renderZone();

    await user.tab();
    await user.upload(picker, RESUME);

    expect(document.activeElement).toBe(picker);
    expect(picker.getAttribute('accept')).toBe(PICKER.accept);
    expect(picker.closest('label')?.classList.contains('touch-target')).toBe(true);
    expect(onFile.mock.calls).toEqual([[RESUME]]);
  });

  it('picking the same file again after a refusal hands it back a second time', async () => {
    const user = userEvent.setup();
    const { onFile, picker } = renderZone();

    await user.upload(picker, RESUME);
    await user.upload(picker, RESUME);

    expect(onFile.mock.calls).toEqual([[RESUME], [RESUME]]);
  });

  it('a file dragged over lights the zone up, and the drop hands back the first file only', () => {
    const { onFile, zone } = renderZone();

    fireEvent.dragEnter(zone, fileDrag([RESUME, SECOND]));
    const lit = zone.hasAttribute('data-dragging');
    fireEvent.drop(zone, fileDrag([RESUME, SECOND]));

    expect(lit).toBe(true);
    expect(zone.hasAttribute('data-dragging')).toBe(false);
    expect(onFile.mock.calls).toEqual([[RESUME]]);
  });

  it('a drag that passes over the text inside stays lit until it leaves the zone itself', () => {
    const { zone } = renderZone();
    const text = screen.getByText('Перетягни PDF або DOCX сюди');

    fireEvent.dragEnter(zone, fileDrag([RESUME]));
    fireEvent.dragEnter(text, fileDrag([RESUME]));
    fireEvent.dragLeave(zone, fileDrag([RESUME]));
    const litOverText = zone.hasAttribute('data-dragging');
    fireEvent.dragLeave(text, fileDrag([RESUME]));

    expect(litOverText).toBe(true);
    expect(zone.hasAttribute('data-dragging')).toBe(false);
  });

  it('dragged text does not light the zone up and its drop hands back nothing', () => {
    const { onFile, zone } = renderZone();
    const textDrag = { dataTransfer: { files: [], types: ['text/plain'] } };

    fireEvent.dragEnter(zone, textDrag);
    fireEvent.drop(zone, textDrag);

    expect(zone.hasAttribute('data-dragging')).toBe(false);
    expect(onFile).not.toHaveBeenCalled();
  });

  it('a disabled zone takes no drop, stays unlit and disables the picker', () => {
    const { onFile, zone, picker } = renderZone({ ...PICKER, disabled: true });

    fireEvent.dragEnter(zone, fileDrag([RESUME]));
    const lit = zone.hasAttribute('data-dragging');
    fireEvent.drop(zone, fileDrag([RESUME]));

    expect(lit).toBe(false);
    expect(onFile).toHaveBeenCalledTimes(0);
    expect(picker.disabled).toBe(true);
    expect(picker.closest('label')?.getAttribute('aria-disabled')).toBe('true');
  });
});
