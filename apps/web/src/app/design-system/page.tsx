import { SOURCE_LABELS } from '@jobflow/shared';
import type { Metadata } from 'next';

import { uk } from '../../shared/i18n/uk';
import { SOURCE_ROWS, TYPE_ROLES } from './specimen';

const SPECIMEN_COPY = uk.designSystem;

export const metadata: Metadata = { title: SPECIMEN_COPY.pageTitle };

const CARD = 'rounded-3xl bg-surface p-7 flex flex-col';
const TILE =
  'rounded-lg bg-surface p-4.5 flex flex-col shadow-e1 transition-shadow duration-(--duration-fast) ease-standard hover:shadow-e2';

const HEADER_SIZES = {
  lead: {
    row: 'gap-4',
    index: 'text-[12px]',
    title: 'font-display text-[27px] leading-[normal] font-medium tracking-[-0.02em]',
  },
  section: {
    row: 'gap-3.5',
    index: 'text-[11px]',
    title: 'font-display text-display leading-[normal]',
  },
};

type SectionHeaderProps = {
  header: { index: string; title: string };
  size: keyof typeof HEADER_SIZES;
};

function SectionHeader({ header, size }: SectionHeaderProps) {
  const classes = HEADER_SIZES[size];
  return (
    <div className={`flex flex-wrap items-baseline leading-[normal] ${classes.row}`}>
      <span
        className={`font-display font-medium tracking-[0.16em] text-ink-3 tabular-nums ${classes.index}`}
      >
        {header.index}
      </span>
      <h2 className={classes.title}>{header.title}</h2>
      <span aria-hidden className="h-px min-w-10 flex-1 bg-line" />
    </div>
  );
}

type CardHeadProps = { head: { eyebrow: string; family: string } };

function CardHead({ head }: CardHeadProps) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-ink-3">
      <span className="text-label leading-[normal] tracking-[0.14em] uppercase">
        {head.eyebrow}
      </span>
      <span className="text-label leading-[normal] font-normal">{head.family}</span>
    </div>
  );
}

function DisplaySpecimen() {
  const copy = SPECIMEN_COPY.typography.display;
  return (
    <div className="rounded-3xl shadow-e3">
      <div data-theme="dark" className={`${CARD} h-full gap-5 text-ink`}>
        <CardHead head={copy} />
        <p className="font-display text-[44px] leading-[1.04] font-medium tracking-[-0.038em]">
          {copy.headline[0]}
          <br />
          {copy.headline[1]}
        </p>
        <p className="font-display text-[56px] leading-none font-semibold tracking-[-0.04em] text-accent tabular-nums">
          {copy.score}
        </p>
        <p className="text-[14px] leading-[1.6] text-ink-2 tabular-nums">{copy.note}</p>
      </div>
    </div>
  );
}

function InterfaceSpecimen() {
  const copy = SPECIMEN_COPY.typography.ui;
  return (
    <div className={`${CARD} gap-4.5 shadow-e1`}>
      <CardHead head={copy} />
      <div className="flex flex-col gap-2">
        <p className="text-[30px] leading-[1.22] font-semibold tracking-[-0.02em]">
          {copy.headline}
        </p>
        <p className="text-[17px] leading-normal text-ink-3 tabular-nums">{copy.subline}</p>
        <p className="body-l text-ink-2 tabular-nums">{copy.lead}</p>
      </div>
      <span aria-hidden className="h-px bg-line-soft" />
      <dl className="grid grid-cols-[1fr_auto_auto] gap-x-5.5 gap-y-1.5 text-[15px] leading-[normal] tabular-nums">
        {SOURCE_ROWS.map((row) => (
          <div key={row.source} className="contents">
            <dt>{SOURCE_LABELS[row.source].labelUk}</dt>
            <dd className="text-right text-ink-3">{row.count}</dd>
            <dd className="text-right font-semibold">{row.share}</dd>
          </div>
        ))}
      </dl>
      <p className="text-body leading-[1.6] text-ink-3 tabular-nums">{copy.note}</p>
    </div>
  );
}

function RoleLadder() {
  return (
    <div className={`${TILE} gap-2.75`}>
      <span className="eyebrow text-ink-3">{SPECIMEN_COPY.scale.eyebrow}</span>
      {TYPE_ROLES.map((role) => (
        <div key={role.role} className="flex items-baseline justify-between gap-3">
          <span className={role.role}>{SPECIMEN_COPY.typeSamples[role.role]}</span>
          <span className="caption text-ink-3 tabular-nums">{role.token}</span>
        </div>
      ))}
    </div>
  );
}

function FocusSample() {
  const copy = SPECIMEN_COPY.checks;
  return (
    <div className={`${TILE} items-start gap-3`}>
      <span className="eyebrow text-ink-3 tabular-nums">{copy.focusEyebrow}</span>
      <a
        href="#typography"
        className="label inline-flex min-h-11 items-center rounded-xs text-accent-ink underline underline-offset-4"
      >
        {copy.link}
      </a>
      <button
        type="button"
        className="label min-h-11 rounded-md bg-accent px-4 text-surface transition-colors duration-(--duration-instant) ease-standard hover:bg-accent-press active:translate-y-px active:bg-accent-press"
      >
        {copy.button}
      </button>
    </div>
  );
}

function MotionSample() {
  const copy = SPECIMEN_COPY.checks;
  return (
    <div className={`${TILE} gap-3`}>
      <span className="eyebrow text-ink-3">{copy.motionEyebrow}</span>
      <span
        aria-hidden
        className="h-2 animate-pulse rounded-pill bg-line [animation-duration:var(--duration-data)] [animation-timing-function:var(--easing)]"
      />
      <p className="caption text-ink-3 tabular-nums">{copy.motionNote}</p>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-[1296px] flex-col gap-30 px-7 pt-13 pb-32.5">
      <h1 className="sr-only">{SPECIMEN_COPY.pageTitle}</h1>
      <section id="typography" className="flex flex-col gap-6.5">
        <SectionHeader header={SPECIMEN_COPY.typography} size="lead" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-5">
          <DisplaySpecimen />
          <InterfaceSpecimen />
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <SectionHeader header={SPECIMEN_COPY.scale} size="section" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(268px,100%),1fr))] gap-3.5">
          <RoleLadder />
          <FocusSample />
          <MotionSample />
        </div>
      </section>
    </main>
  );
}
