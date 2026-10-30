import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { uk } from '@/shared/i18n';
import { quietLogs } from '@/test/quiet-logs';

import { CrashBoundary } from './crash-boundary';

const DEMO = uk.devUi.errorPanels.crashDemo;

const SECRET = 'token=abc123 leaked from the widget';

const CODE_IN_META = /^код ([0-9a-f]{8}) · /;

function Widget({ broken }: Readonly<{ broken: boolean }>) {
  if (broken) throw new Error(SECRET);
  return <p>{DEMO.widget}</p>;
}

function Page() {
  const [broken, setBroken] = useState(false);
  const [presses, setPresses] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setBroken(true);
        }}
      >
        {DEMO.break}
      </button>
      <button
        type="button"
        onClick={() => {
          setPresses((count) => count + 1);
        }}
      >
        {`presses ${String(presses)}`}
      </button>
      <CrashBoundary
        onReset={() => {
          setBroken(false);
        }}
      >
        <Widget broken={broken} />
      </CrashBoundary>
    </>
  );
}

async function breakWidget() {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(screen.getByRole('button', { name: 'Зламати блок' }));
  return user;
}

function shownCode(): string {
  const meta = screen.getByText(CODE_IN_META);
  return CODE_IN_META.exec(meta.textContent)?.[1] ?? '';
}

describe('CrashBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a widget that throws shows the crash panel with an 8-hex code and never the error text', async () => {
    quietLogs();
    await breakWidget();

    expect(screen.getByRole('heading', { name: 'Щось зламалось у нас, не в тебе' })).toBeDefined();
    expect(screen.getByText('Блок впав')).toBeDefined();
    expect(shownCode()).toMatch(/^[0-9a-f]{8}$/);
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it('a control outside the crashed widget keeps working', async () => {
    quietLogs();
    const user = await breakWidget();

    await user.click(screen.getByRole('button', { name: 'presses 0' }));

    expect(screen.getByRole('button', { name: 'presses 1' })).toBeDefined();
  });

  it('reload resets the widget and brings it back', async () => {
    quietLogs();
    const user = await breakWidget();

    await user.click(screen.getByRole('button', { name: 'Перезавантажити' }));

    expect(screen.getByText(DEMO.widget)).toBeDefined();
    expect(screen.queryByText('Блок впав')).toBeNull();
  });

  it('logs the crash under the same code the panel shows', async () => {
    const logged = quietLogs();
    await breakWidget();

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]?.[0]).toMatchObject({ code: shownCode() });
  });
});
