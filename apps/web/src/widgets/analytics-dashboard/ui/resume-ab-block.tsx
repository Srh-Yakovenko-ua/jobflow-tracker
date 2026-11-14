'use client';

import { useUserTimeZone } from '@/entities/user';

import { resumeAbViewOf } from '../lib/resume-ab-view';
import type { ResumeAbFrame } from '../model/dashboard-view';
import { EvidenceBlock } from './evidence-block';

export type ResumeAbBlockProps = Readonly<{ frame: ResumeAbFrame }>;

export function ResumeAbBlock({ frame }: ResumeAbBlockProps) {
  const timeZone = useUserTimeZone();
  return <EvidenceBlock frame={frame} viewOf={(data) => resumeAbViewOf({ data, timeZone })} />;
}
