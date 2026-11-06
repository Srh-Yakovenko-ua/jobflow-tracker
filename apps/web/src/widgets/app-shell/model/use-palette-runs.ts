import { useRouter } from 'next/navigation';

import type { PageCommand } from '@/shared/lib/page-commands';

import type { PaletteRun } from './palette-commands';
import { type RecentApplication, rememberRecentApplication } from './recent-applications';
import { useUserId } from './use-palette-target';
import type { ShellSurfaces } from './use-shell-surfaces';
import { useThemeFlip } from './use-theme-flip';

export type PalettePageId = 'root' | 'move';

export type PaletteRootActions = Readonly<{
  onRun: (run: PaletteRun) => void;
  onOpenApplication: (application: RecentApplication) => void;
  onCommand: (command: PageCommand) => void;
}>;

export type PaletteRunsInput = Readonly<{
  surfaces: ShellSurfaces;
  goTo: (page: PalettePageId) => void;
}>;

type Runner = PaletteRunsInput & Readonly<{ push: (href: string) => void; flipTheme: () => void }>;

function runnerOf({ surfaces, goTo, push, flipTheme }: Runner) {
  const close = surfaces.closeThen;
  return (run: PaletteRun) => {
    switch (run.kind) {
      case 'navigate':
        close(() => {
          push(run.href);
        });
        return;
      case 'move':
        goTo('move');
        return;
      case 'theme':
        close(flipTheme);
        return;
      case 'shortcuts':
        close(() => {
          surfaces.open('shortcuts');
        });
        return;
      default: {
        const unhandled: never = run;
        throw new Error(`Unknown palette run ${JSON.stringify(unhandled)}`);
      }
    }
  };
}

export function usePaletteRuns({ surfaces, goTo }: PaletteRunsInput): PaletteRootActions {
  const router = useRouter();
  const userId = useUserId();
  const flipTheme = useThemeFlip();
  const push = (href: string) => {
    router.push(href);
  };
  return {
    onRun: runnerOf({ surfaces, goTo, push, flipTheme }),
    onOpenApplication: (application) => {
      if (userId !== undefined) rememberRecentApplication({ userId, application });
      surfaces.closeThen(() => {
        push(`/applications/${application.id}`);
      });
    },
    onCommand: (command) => {
      surfaces.closeThen(command.run);
    },
  };
}
