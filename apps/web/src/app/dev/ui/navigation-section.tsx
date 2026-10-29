'use client';

import { uk } from '@/shared/i18n';
import { Kbd } from '@/shared/ui/kbd';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

import { GallerySection, Note, PANEL, Specimen } from './gallery';

const COPY = uk.devUi.navigation;

type GalleryTab = { value: string; label: string; panel: string; count?: number };

const TABS: readonly GalleryTab[] = [
  { value: 'board', ...COPY.tabs.board },
  { value: 'analytics', ...COPY.tabs.analytics },
  { value: 'reminders', ...COPY.tabs.reminders, count: 3 },
  { value: 'resumes', ...COPY.tabs.resumes },
];

export function NavigationSection() {
  return (
    <GallerySection header={COPY}>
      <div className={PANEL}>
        <Specimen eyebrow={COPY.tabsEyebrow}>
          <Tabs defaultValue="board" className="flex flex-col gap-3">
            <TabsList aria-label={COPY.tabsLabel}>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} count={tab.count}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {TABS.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                className="rounded-sm text-body text-ink-2"
              >
                {tab.panel}
              </TabsContent>
            ))}
          </Tabs>
        </Specimen>
        <Specimen eyebrow={COPY.kbdEyebrow}>
          <div className="flex flex-wrap items-center gap-2">
            {COPY.keys.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </div>
          <Note>{COPY.kbdHint}</Note>
        </Specimen>
      </div>
    </GallerySection>
  );
}
