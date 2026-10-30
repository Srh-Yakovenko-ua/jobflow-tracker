import { type ApplicationResponse, countedUk, DAY_FORMS_UK } from '@jobflow/shared';
import type { ReactNode, Ref } from 'react';

import { formatSalaryRange, StageChip } from '@/entities/application';
import type { EditField } from '@/features/edit-application';
import { uk } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

import { EditTrigger } from './edit-trigger';

type OnEdit = (field: EditField) => void;

export type ApplicationHeaderProps = Readonly<{
  application: ApplicationResponse;
  titleRef: Ref<HTMLHeadingElement>;
  editor: { editing: boolean; onEdit: OnEdit };
  children: ReactNode;
}>;

type EditableProps = Readonly<{ application: ApplicationResponse; onEdit: OnEdit }>;

const TITLE =
  'font-display text-[clamp(26px,3.5vw,38px)] leading-[1.05] font-medium tracking-[-0.036em]';

const STACK_CHIP =
  'mx-0 rounded-md px-2 py-0.5 text-[12.5px] text-ink-2 inset-ring inset-ring-line-soft';

function placeOf({ location, workMode }: ApplicationResponse): string | null {
  const parts = [location, workMode === null ? null : uk.application.workModes[workMode]];
  const place = parts.filter((part) => part !== null).join(' / ');
  return place === '' ? null : place;
}

function MetaDot() {
  return <span aria-hidden className="size-1 rounded-full bg-line" />;
}

function MetaLine({ application, onEdit }: EditableProps) {
  const salary = formatSalaryRange(application);
  const place = placeOf(application);
  return (
    <p className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[16px] text-ink-2">
      <EditTrigger
        onEdit={() => {
          onEdit('company');
        }}
        className="font-semibold"
      >
        {application.company}
      </EditTrigger>
      {salary !== null && <MetaDot />}
      {salary !== null && (
        <EditTrigger
          onEdit={() => {
            onEdit('salaryMin');
          }}
          className="tabular-nums"
        >
          {salary}
        </EditTrigger>
      )}
      {place !== null && <MetaDot />}
      {place !== null && (
        <EditTrigger
          onEdit={() => {
            onEdit('location');
          }}
        >
          {place}
        </EditTrigger>
      )}
    </p>
  );
}

function StackChips({ application, onEdit }: EditableProps) {
  if (application.stack.length === 0) return null;
  return (
    <ul aria-label={uk.applicationPage.stack} className="flex flex-wrap gap-1.5">
      {application.stack.map((technology) => (
        <li key={technology} className="flex">
          <EditTrigger
            onEdit={() => {
              onEdit('stack');
            }}
            className={STACK_CHIP}
          >
            {technology}
          </EditTrigger>
        </li>
      ))}
    </ul>
  );
}

export function ApplicationHeader({
  application,
  titleRef,
  editor,
  children,
}: ApplicationHeaderProps) {
  const days = countedUk(application.daysInStage, DAY_FORMS_UK);
  return (
    <section className="flex flex-col gap-4.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <StageChip stage={application.currentStage} view={{ size: 'sm' }} />
        <span className="text-[11px] font-semibold text-ink-3 tabular-nums">
          {uk.application.daysInStage(days)}
        </span>
      </div>
      <h1 ref={titleRef} tabIndex={-1} className={cn(TITLE, editor.editing && 'sr-only')}>
        {editor.editing ? (
          application.position
        ) : (
          <EditTrigger
            onEdit={() => {
              editor.onEdit('position');
            }}
          >
            {application.position}
          </EditTrigger>
        )}
      </h1>
      {!editor.editing && <MetaLine application={application} onEdit={editor.onEdit} />}
      {!editor.editing && <StackChips application={application} onEdit={editor.onEdit} />}
      {children}
    </section>
  );
}
