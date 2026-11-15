import type { RejectionReasonCode } from '@jobflow/shared';

export type ReasonPattern = 'solid' | 'stripes' | 'dots' | 'cross' | 'grid' | 'dashes';

export const REASON_PATTERNS: Record<RejectionReasonCode, ReasonPattern> = {
  skills_gap: 'solid',
  english_level: 'stripes',
  salary_expectations: 'dots',
  chose_other: 'cross',
  position_closed: 'grid',
  no_explanation: 'dashes',
  low_salary: 'solid',
  office_schedule: 'stripes',
  red_flags: 'dots',
  accepted_other: 'cross',
  silence_timeout: 'solid',
  unspecified: 'stripes',
};

export type PatternFillInput = Readonly<{ colour: string; pattern: ReasonPattern; ink: string }>;

const TILE = { size: 8, line: 1.5, dot: 1.5 } as const;

const MID = TILE.size / 2;

type Stroke = (context: CanvasRenderingContext2D) => void;

function line(points: readonly (readonly [number, number])[]): Stroke {
  return (context) => {
    context.beginPath();
    for (const [index, [x, y]] of points.entries()) {
      if (index % 2 === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  };
}

const STROKES: Record<Exclude<ReasonPattern, 'solid'>, Stroke> = {
  stripes: line([
    [0, TILE.size],
    [TILE.size, 0],
  ]),
  cross: line([
    [0, 0],
    [TILE.size, TILE.size],
    [TILE.size, 0],
    [0, TILE.size],
  ]),
  grid: line([
    [MID, 0],
    [MID, TILE.size],
    [0, MID],
    [TILE.size, MID],
  ]),
  dashes: line([
    [1, MID],
    [MID + 1, MID],
  ]),
  dots: (context) => {
    context.beginPath();
    context.arc(MID, MID, TILE.dot, 0, 2 * Math.PI);
    context.fill();
  },
};

export function patternFill({ colour, pattern, ink }: PatternFillInput): string | CanvasPattern {
  if (pattern === 'solid') return colour;
  const tile = document.createElement('canvas');
  tile.width = TILE.size;
  tile.height = TILE.size;
  const context = tile.getContext('2d');
  if (context === null) return colour;
  context.fillStyle = colour;
  context.fillRect(0, 0, TILE.size, TILE.size);
  context.fillStyle = ink;
  context.strokeStyle = ink;
  context.lineWidth = TILE.line;
  STROKES[pattern](context);
  return context.createPattern(tile, 'repeat') ?? colour;
}
