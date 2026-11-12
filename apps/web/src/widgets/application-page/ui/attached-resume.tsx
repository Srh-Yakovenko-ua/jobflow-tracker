'use client';

import { type ApplicationResponse, type ResumeVersion, resumeVersionLabel } from '@jobflow/shared';
import { Eye } from 'lucide-react';
import Link from 'next/link';

import { fileFormatOf, usePreviewVersion } from '@/features/edit-resume-version';
import { type RelinkActions, VersionPicker } from '@/features/relink-resume-version';
import { uk } from '@/shared/i18n';
import { Button, buttonLinkClasses } from '@/shared/ui/button';
import { LoadFailedPanel } from '@/shared/ui/error-panel';
import { TextSkeleton } from '@/shared/ui/skeleton';

import { type AttachedResumeState, useAttachedResume } from '../model/use-attached-resume';
import { ApplicationSection } from './application-section';

export type AttachedResumeProps = Readonly<{
  application: ApplicationResponse;
  actions: RelinkActions;
}>;

type LinkedResumeProps = AttachedResumeProps &
  Readonly<{ linked: ResumeVersion; resume: AttachedResumeState }>;

type ResumeBodyProps = AttachedResumeProps & Readonly<{ resume: AttachedResumeState }>;

const COPY = uk.applicationPage.resume;

const RESUMES_HREF = '/resumes';

function LinkedResume({ application, actions, linked, resume }: LinkedResumeProps) {
  const preview = usePreviewVersion();
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold wrap-anywhere">{resumeVersionLabel(linked)}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3 tabular-nums">
          {COPY.uploaded(resume.dayLabel(linked.uploadedAt), linked.applicationsCount)}
          <span className="rounded-md px-1.75 py-0.5 text-[12px] font-semibold text-ink-2 inset-ring inset-ring-stage-screening">
            {uk.resumes.lowData}
          </span>
        </p>
      </div>
      <span aria-hidden className="h-px self-stretch bg-line-soft" />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={<Eye aria-hidden size={16} strokeWidth={1.9} />}
          onClick={() => {
            preview(linked.id);
          }}
        >
          {COPY.preview(fileFormatOf(linked))}
        </Button>
        <VersionPicker application={application} versions={resume.versions} actions={actions} />
      </div>
    </>
  );
}

function ResumeBody({ application, actions, resume }: ResumeBodyProps) {
  const { load, linked, versions } = resume;
  if (load.pending) return <TextSkeleton />;
  if (load.failed) return <LoadFailedPanel onRetry={load.onRetry} />;
  if (linked !== null) {
    return (
      <LinkedResume application={application} actions={actions} linked={linked} resume={resume} />
    );
  }
  return (
    <>
      <p className="text-[13px] text-ink-3">{COPY.none}</p>
      {versions.some(({ isArchived }) => !isArchived) ? (
        <VersionPicker application={application} versions={versions} actions={actions} />
      ) : (
        <Link href={RESUMES_HREF} className={buttonLinkClasses({ variant: 'outline', size: 'sm' })}>
          {COPY.upload}
        </Link>
      )}
    </>
  );
}

export function AttachedResume({ application, actions }: AttachedResumeProps) {
  const resume = useAttachedResume(application);
  return (
    <ApplicationSection
      title={{ text: COPY.kicker, look: 'eyebrow' }}
      view={{
        className: 'flex flex-col items-start gap-3.5 rounded-lg bg-surface p-4.5 shadow-e1',
        busy: resume.load.pending,
      }}
    >
      <ResumeBody application={application} actions={actions} resume={resume} />
    </ApplicationSection>
  );
}
