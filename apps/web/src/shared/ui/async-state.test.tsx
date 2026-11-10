import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';

import { type AiJob, AsyncState } from './async-state';

describe('AsyncState', () => {
  it.each<{ name: string; job: AiJob; line: string }>([
    {
      name: 'two tasks ahead',
      job: { status: 'queued', ahead: 2, etaSeconds: 90 },
      line: 'у черзі · 2 задачі перед твоєю · ~2 хв',
    },
    {
      name: 'nobody ahead',
      job: { status: 'queued', ahead: 0, etaSeconds: 30 },
      line: 'у черзі · твоя задача наступна · ~30 с',
    },
    {
      name: 'the second of three steps',
      job: { status: 'processing', step: 2, steps: 3 },
      line: 'крок 2 з 3 · обробляється',
    },
    { name: 'a job done in 6 s', job: { status: 'done', tookSeconds: 6 }, line: 'готово за 6 с' },
    { name: 'a failed job', job: { status: 'failed' }, line: 'AI не впорався' },
  ])('$name reads its own status line', ({ job, line }) => {
    render(<AsyncState job={job} />);

    expect(within(screen.getByRole('status')).getByText(line)).toBeDefined();
  });

  it('a step with an ETA says the page can be closed and fills the bar to the step', () => {
    const { container } = render(
      <AsyncState job={{ status: 'processing', step: 1, steps: 2, etaSeconds: 20 }} />,
    );

    expect(screen.getByText('~20 с · можна закрити сторінку')).toBeDefined();
    expect(container.querySelector<HTMLElement>('[aria-hidden] > span')?.style.width).toBe('50%');
  });

  it('a queued dot pulses only under motion-safe, a done dot stays still', () => {
    const { container, rerender } = render(
      <AsyncState job={{ status: 'queued', ahead: 1, etaSeconds: 10 }} />,
    );
    expect(container.querySelector('.motion-safe\\:animate-pulse')).not.toBeNull();
    expect(container.querySelector('.animate-pulse')).toBeNull();

    rerender(<AsyncState job={{ status: 'done', tookSeconds: 4 }} />);
    expect(container.querySelector('.motion-safe\\:animate-pulse')).toBeNull();
  });

  it('a failed job reads its line as the small uppercase eyebrow, a finished one keeps the label look', () => {
    const { rerender } = render(<AsyncState job={{ status: 'failed' }} />);
    const failed = [...(screen.getByText('AI не впорався').closest('p')?.classList ?? [])];
    expect(failed).toEqual(
      expect.arrayContaining([
        'uppercase',
        'text-[10px]',
        'font-semibold',
        'tracking-[0.12em]',
        'text-danger',
      ]),
    );
    expect(failed).not.toContain('label');

    rerender(<AsyncState job={{ status: 'done', tookSeconds: 4 }} />);
    const done = [...(screen.getByText('готово за 4 с').closest('p')?.classList ?? [])];
    expect(done).toContain('label');
    expect(done).not.toContain('uppercase');
  });

  it('a failed job says the data is safe and offers the manual way first, then a retry', async () => {
    const user = userEvent.setup();
    const actions = { onManual: vi.fn(), onRetry: vi.fn() };
    render(<AsyncState job={{ status: 'failed' }} actions={actions} />);

    expect(screen.getByText('Дані цілі, нічого не втрачено.')).toBeDefined();
    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Заповнити вручну', 'Спробувати ще раз']);

    await user.click(screen.getByRole('button', { name: 'Заповнити вручну' }));
    await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(actions.onManual).toHaveBeenCalledTimes(1);
    expect(actions.onRetry).toHaveBeenCalledTimes(1);
  });

  it('a failed job with a delete action offers it last, and without a retry action shows no retry', async () => {
    const user = userEvent.setup();
    const actions = { onManual: vi.fn(), onDelete: vi.fn() };
    render(<AsyncState job={{ status: 'failed' }} actions={actions} />);

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Заповнити вручну', 'Видалити картку']);

    await user.click(screen.getByRole('button', { name: 'Видалити картку' }));
    expect(actions.onDelete).toHaveBeenCalledTimes(1);
    expect(actions.onManual).not.toHaveBeenCalled();
  });

  it('a retry on its way keeps the retry button busy and takes no second click', async () => {
    const user = userEvent.setup();
    const actions = { onManual: vi.fn(), onRetry: vi.fn(), retrying: true };
    render(<AsyncState job={{ status: 'failed' }} actions={actions} />);

    const retry = screen.getByRole<HTMLButtonElement>('button', { name: 'Спробувати ще раз' });
    await user.click(retry);

    expect(retry.getAttribute('aria-busy')).toBe('true');
    expect(retry.disabled).toBe(true);
    expect(actions.onRetry).not.toHaveBeenCalled();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Заповнити вручну' }).disabled,
    ).toBe(false);
  });

  it('shows the operation content the caller passes in', () => {
    render(
      <AsyncState job={{ status: 'done', tookSeconds: 6 }}>
        <p>{uk.devUi.asyncStates.done}</p>
      </AsyncState>,
    );

    expect(
      within(screen.getByRole('status')).getByText(
        'Драфт готовий, можна правити перед відправкою.',
      ),
    ).toBeDefined();
  });
});
