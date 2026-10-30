import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Button } from './button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from './menu';

const NAV = uk.shell.nav;

function ThemeMenu() {
  const [theme, setTheme] = useState('light');
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="secondary">{uk.shell.userMenu}</Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem>{NAV.settings}</MenuItem>
        <MenuSeparator />
        <MenuLabel>{uk.ui.theme}</MenuLabel>
        <MenuRadioGroup value={theme} onValueChange={setTheme}>
          <MenuRadioItem value="light">{uk.theme.light}</MenuRadioItem>
          <MenuRadioItem value="dark">{uk.theme.dark}</MenuRadioItem>
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

async function openWithEnter() {
  const user = userEvent.setup();
  render(<ThemeMenu />);
  const trigger = screen.getByRole('button', { name: uk.shell.userMenu });
  await user.tab();
  await user.keyboard('{Enter}');
  await screen.findByRole('menu');
  return { user, trigger };
}

describe('Menu', () => {
  it('Enter on the trigger opens the menu with focus on its first item', async () => {
    await openWithEnter();

    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: NAV.settings }));
  });

  it('arrows walk the items and Escape closes the menu with focus back on the trigger', async () => {
    const { user, trigger } = await openWithEnter();

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      screen.getByRole('menuitemradio', { name: uk.theme.light }),
    );
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: uk.theme.dark }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('gives every item a 44px touch height below md', async () => {
    await openWithEnter();

    const items = [...screen.getAllByRole('menuitem'), ...screen.getAllByRole('menuitemradio')].map(
      (item) => item.className.split(' '),
    );

    expect(items.filter((classes) => classes.includes('max-md:min-h-11'))).toHaveLength(3);
  });

  it('marks the picked radio item checked and the other one unchecked', async () => {
    const { user } = await openWithEnter();

    await user.click(screen.getByRole('menuitemradio', { name: uk.theme.dark }));
    await user.click(screen.getByRole('button', { name: uk.shell.userMenu }));

    expect(
      screen.getByRole('menuitemradio', { name: uk.theme.dark }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('menuitemradio', { name: uk.theme.light }).getAttribute('aria-checked'),
    ).toBe('false');
  });
});
