import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type PageCommand,
  PageCommandsProvider,
  usePageCommands,
  useRegisterPageCommand,
} from './page-commands';

type RegistrarProps = Readonly<{ command: PageCommand }>;

function Registrar({ command }: RegistrarProps) {
  useRegisterPageCommand(command);
  return null;
}

function Listing() {
  const commands = usePageCommands();
  return (
    <ul aria-label="commands">
      {commands.map((command) => (
        <li key={command.id}>
          <button type="button" onClick={command.run}>
            {command.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function renderRegistry(command: PageCommand | null) {
  const tree = (registered: PageCommand | null) => (
    <PageCommandsProvider>
      {registered && <Registrar command={registered} />}
      <Listing />
    </PageCommandsProvider>
  );
  const { rerender } = render(tree(command));
  return {
    update: (next: PageCommand | null) => {
      rerender(tree(next));
    },
  };
}

function listedLabels(): string[] {
  return screen.queryAllByRole('button').map((button) => button.textContent);
}

const DENSITY: PageCommand = { id: 'density', label: 'Щільний режим', run: () => undefined };

describe('page commands', () => {
  it('a mounted page adds its command, a new label replaces it, unmounting removes it', () => {
    const { update } = renderRegistry(DENSITY);
    expect(listedLabels()).toEqual(['Щільний режим']);

    update({ ...DENSITY, label: 'Повний режим' });
    expect(listedLabels()).toEqual(['Повний режим']);

    update(null);
    expect(listedLabels()).toEqual([]);
  });

  it('runs the latest run the page gave, even when only the run changed', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { update } = renderRegistry({ ...DENSITY, run: first });

    update({ ...DENSITY, run: latest });
    screen.getByRole('button', { name: DENSITY.label }).click();

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('a page rendered without the provider registers nothing and does not throw', () => {
    render(<Registrar command={DENSITY} />);

    expect(screen.queryByRole('list')).toBeNull();
  });
});
