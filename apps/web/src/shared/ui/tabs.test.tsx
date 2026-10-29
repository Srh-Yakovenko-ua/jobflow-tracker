import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { uk } from '@/shared/i18n';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

const COPY = uk.devUi.navigation;

const { board, analytics, reminders } = COPY.tabs;

function renderTabs() {
  render(
    <Tabs defaultValue="board">
      <TabsList aria-label={COPY.tabsLabel}>
        <TabsTrigger value="board">{board.label}</TabsTrigger>
        <TabsTrigger value="analytics">{analytics.label}</TabsTrigger>
        <TabsTrigger value="reminders" count={3}>
          {reminders.label}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="board">{board.panel}</TabsContent>
      <TabsContent value="analytics">{analytics.panel}</TabsContent>
      <TabsContent value="reminders">{reminders.panel}</TabsContent>
    </Tabs>,
  );
}

describe('Tabs', () => {
  it('ArrowRight selects the next tab and shows its panel, End jumps to the last', async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe(analytics.label);
    expect(screen.getByRole('tabpanel').textContent).toBe(analytics.panel);

    await user.keyboard('{End}');
    expect(screen.getByRole('tabpanel').textContent).toBe(reminders.panel);
  });

  it('a count is read as part of the tab name', () => {
    renderTabs();

    expect(screen.getByRole('tab', { name: `${reminders.label} 3` })).toBeDefined();
  });
});
