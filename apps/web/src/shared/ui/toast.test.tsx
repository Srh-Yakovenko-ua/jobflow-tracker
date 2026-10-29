import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast, Toaster } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { showToast } from './toast';

const COPY = uk.devUi.feedback.realToast;

function showActionToast() {
  const onAction = vi.fn();
  render(<Toaster />);
  act(() => {
    showToast({
      tone: 'success',
      title: COPY.title,
      description: COPY.description,
      action: { label: COPY.action, onAction },
    });
  });
  return onAction;
}

describe('showToast', () => {
  afterEach(() => {
    toast.dismiss();
  });

  it('Alt+T and Tab reach the action, Enter runs it once and the toast leaves', async () => {
    const user = userEvent.setup();
    const onAction = showActionToast();
    const action = await screen.findByRole('button', { name: COPY.action });

    await user.keyboard('{Alt>}[KeyT]{/Alt}');
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(action);
    await user.keyboard('{Enter}');

    expect(onAction).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByText(COPY.title)).toBeNull();
    });
  });

  it('a double press runs the action only once', async () => {
    const user = userEvent.setup();
    const onAction = showActionToast();

    await user.dblClick(await screen.findByRole('button', { name: COPY.action }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
