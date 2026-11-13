import {
  type ApplicationResponse,
  isActiveStage,
  type Note,
  REJECTION_REASONS,
  rejectionReasonCodeSchema,
  type ResumeVersion,
  type ScheduledEventKind,
  scheduledEventKindSchema,
  SOURCE_LABELS,
  type Stage,
  stageSchema,
  type TimelineItem,
  type TimelineItemType,
} from '@jobflow/shared';

import { uk } from '@/shared/i18n';

export type TimelineMarker =
  { kind: 'stage'; stage: Stage } | { kind: 'ring' } | { kind: 'silence' };

export type TimelineTone = 'muted' | 'medium' | 'strong';

export type TimelineMetaFormat = 'text' | 'note';

export type TimelineRow = {
  id: TimelineItem['id'];
  at: Date;
  title: string;
  meta: string | null;
  metaFormat: TimelineMetaFormat;
  marker: TimelineMarker;
  tone: TimelineTone;
};

export type TimelineRowsInput = {
  items: readonly TimelineItem[];
  application: ApplicationResponse;
  notes?: readonly Note[];
  linkedVersion?: Pick<ResumeVersion, 'number' | 'uploadedAt'> | undefined;
};

type Meta = TimelineItem['meta'];

type MetaValue = Meta[string] | undefined;

type Folded = { parsed: TimelineItem | undefined; confirmed: TimelineItem | undefined };

type MetaContext = Folded & {
  meta: Meta;
  application: ApplicationResponse;
  note: Note | undefined;
};

type RowLook = {
  marker: (meta: Meta) => TimelineMarker;
  tone: TimelineTone;
  meta: (context: MetaContext) => string | null;
};

const COPY = uk.timeline;

const RING: TimelineMarker = { kind: 'ring' };

const INTERVIEW_STAGES: Record<ScheduledEventKind, Stage | null> = {
  screening_call: 'screening',
  tech_interview: 'tech_interview',
  final_interview: 'final',
  offer_call: 'offer',
  other: null,
};

const ringed = () => RING;

const noMeta = () => null;

export function stageOf(value: MetaValue): Stage | null {
  const parsed = stageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function textOf(value: MetaValue): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function markerOf(stage: Stage | null): TimelineMarker {
  return stage === null ? RING : { kind: 'stage', stage };
}

function stageMoveMarker(meta: Meta): TimelineMarker {
  const toStage = stageOf(meta.toStage);
  if (toStage === null || !isActiveStage(toStage)) {
    return markerOf(toStage);
  }
  return markerOf(stageOf(meta.fromStage) ?? toStage);
}

function interviewMarker(meta: Meta): TimelineMarker {
  const kind = scheduledEventKindSchema.safeParse(meta.kind);
  return markerOf(kind.success ? INTERVIEW_STAGES[kind.data] : null);
}

function daysInStageOf(meta: Meta): string | null {
  const fromStage = stageOf(meta.fromStage);
  const days = meta.daysInPreviousStage;
  if (fromStage === null || typeof days !== 'number') {
    return null;
  }
  return COPY.daysInStage(days, COPY.stageGenitive[fromStage]);
}

function reasonOf(meta: Meta): string | null {
  const code = rejectionReasonCodeSchema.safeParse(meta.reasonCode);
  return code.success ? COPY.reason(REJECTION_REASONS[code.data].labelUk) : null;
}

function stageMoveMeta({ meta, application }: MetaContext): string {
  if (meta.fromStage === null) {
    return COPY.via(SOURCE_LABELS[application.source].labelUk);
  }
  const parts = [COPY.movedByHand, daysInStageOf(meta), reasonOf(meta), textOf(meta.comment)];
  return parts.filter((part) => part !== null).join(' ');
}

function capturedMeta({ parsed, confirmed }: MetaContext): string | null {
  if (confirmed === undefined) {
    return parsed?.title ?? null;
  }
  return parsed === undefined ? COPY.fieldsChecked.alone : COPY.fieldsChecked.after(parsed.title);
}

const LOOKS: Record<TimelineItemType, RowLook> = {
  stage_changed: { marker: stageMoveMarker, tone: 'strong', meta: stageMoveMeta },
  captured: { marker: ringed, tone: 'medium', meta: capturedMeta },
  ai_parsed: { marker: ringed, tone: 'muted', meta: noMeta },
  silence_started: {
    marker: () => ({ kind: 'silence' }),
    tone: 'muted',
    meta: () => COPY.silenceMeta,
  },
  followup_generated: { marker: ringed, tone: 'muted', meta: noMeta },
  followup_sent: { marker: ringed, tone: 'strong', meta: noMeta },
  interview_scheduled: { marker: ringed, tone: 'strong', meta: noMeta },
  interview_done: { marker: interviewMarker, tone: 'strong', meta: noMeta },
  note_added: {
    marker: ringed,
    tone: 'strong',
    meta: ({ meta, note }) => textOf(note?.body ?? meta.body),
  },
  resume_attached: { marker: ringed, tone: 'strong', meta: noMeta },
  draft_confirmed: { marker: ringed, tone: 'muted', meta: noMeta },
  match_scored: { marker: ringed, tone: 'muted', meta: noMeta },
};

function foldedOf(items: readonly TimelineItem[]): Folded {
  if (!items.some((item) => item.type === 'captured')) {
    return { parsed: undefined, confirmed: undefined };
  }
  return {
    parsed: items.filter((item) => item.type === 'ai_parsed').at(-1),
    confirmed: items.find((item) => item.type === 'draft_confirmed'),
  };
}

function isApplied({ type, meta }: TimelineItem): boolean {
  return type === 'stage_changed' && meta.fromStage === null && meta.toStage === 'applied';
}

function sentVersionOf({ items, application, linkedVersion }: TimelineRowsInput) {
  if (linkedVersion === undefined) return undefined;
  const attachedLater = items.some((item) => item.type === 'resume_attached');
  const uploadedLater = Date.parse(linkedVersion.uploadedAt) > Date.parse(application.createdAt);
  return attachedLater || uploadedLater ? undefined : linkedVersion;
}

function titleOf(item: TimelineItem, sentVersion: TimelineRowsInput['linkedVersion']): string {
  if (sentVersion === undefined || !isApplied(item)) return item.title;
  return COPY.sentWithCv(item.title, sentVersion.number);
}

export function timelineRowsOf(input: TimelineRowsInput): TimelineRow[] {
  const { items, application, notes = [] } = input;
  const folded = foldedOf(items);
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const sentVersion = sentVersionOf(input);
  return items
    .filter((item) => item !== folded.parsed && item !== folded.confirmed)
    .map((item): TimelineRow => {
      const { id, type, occurredAt, meta } = item;
      const look = LOOKS[type];
      return {
        id,
        at: new Date(occurredAt),
        title: titleOf(item, sentVersion),
        meta: look.meta({ ...folded, meta, application, note: notesById.get(id) }),
        metaFormat: type === 'note_added' ? 'note' : 'text',
        marker: look.marker(meta),
        tone: look.tone,
      };
    });
}
