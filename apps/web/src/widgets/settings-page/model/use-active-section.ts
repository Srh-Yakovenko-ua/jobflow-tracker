'use client';

import { useEffect, useState } from 'react';

import { usePageHash } from '@/shared/lib/use-page-hash';

import { sectionOfHash, type SettingsSectionId } from './settings-items';

const READING_BAND: IntersectionObserverInit = { rootMargin: '-15% 0px -75% 0px' };

type SeenSection = Readonly<{ hash: string; section: SettingsSectionId }>;

type SectionsInBand = Readonly<{
  entries: readonly IntersectionObserverEntry[];
  sections: readonly SettingsSectionId[];
}>;

function firstInBand({ entries, sections }: SectionsInBand): SettingsSectionId | undefined {
  const inBand = new Set(
    entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target.id),
  );
  return sections.find((section) => inBand.has(section));
}

export function useActiveSection(sections: readonly SettingsSectionId[]): SettingsSectionId {
  const hash = usePageHash();
  const [seen, setSeen] = useState<SeenSection | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const section = firstInBand({ entries, sections });
      if (section !== undefined) setSeen({ hash: window.location.hash, section });
    }, READING_BAND);
    sections.forEach((section) => {
      const element = document.getElementById(section);
      if (element !== null) observer.observe(element);
    });
    return () => {
      observer.disconnect();
    };
  }, [sections]);
  return seen?.hash === hash ? seen.section : sectionOfHash(hash.slice(1));
}
