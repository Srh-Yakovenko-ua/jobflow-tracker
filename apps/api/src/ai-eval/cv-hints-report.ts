import type { CvHint, CvHintsInput, CvHintsOutput } from '@jobflow/shared';

import type { EvalReport } from './eval-cases.js';

export type CvHintsCaseAnswer = { file: string; input: CvHintsInput; absent: string[] } & (
  { output: CvHintsOutput } | { error: string }
);

type Hinted = Extract<CvHintsCaseAnswer, { output: CvHintsOutput }>;

type HintFaults = { evidence: number; requirement: number; absent: number };

const tsv = (cells: (string | number)[]) => cells.join('\t');

const normalized = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

function profileItemsOf({ profile }: CvHintsInput): Set<string> {
  const items = [
    ...profile.skills.flatMap((skill) => [skill.name, skill.evidence ?? '']),
    ...profile.positions.map((position) => position.title),
    ...profile.domains,
    profile.leadership.evidence ?? '',
  ];
  return new Set(items.filter((item) => item !== '').map(normalized));
}

function partialRequirementsOf({ requirements }: CvHintsInput): Set<string> {
  const partial = requirements.filter((requirement) => requirement.coverage === 'partial');
  return new Set(partial.map((requirement) => normalized(requirement.name)));
}

function namesAbsent(hint: CvHint, absent: string[]): boolean {
  const text = normalized([hint.requirement, hint.evidenceInCv, hint.suggestion].join(' '));
  return absent.some((term) => text.includes(normalized(term)));
}

function faultsOf({ input, absent, output }: Hinted): HintFaults {
  const items = profileItemsOf(input);
  const partial = partialRequirementsOf(input);
  const count = (fault: (hint: CvHint) => boolean) => output.hints.filter(fault).length;
  return {
    evidence: count((hint) => !items.has(normalized(hint.evidenceInCv))),
    requirement: count((hint) => !partial.has(normalized(hint.requirement))),
    absent: count((hint) => namesAbsent(hint, absent)),
  };
}

function rowOf(answer: CvHintsCaseAnswer): string {
  if ('error' in answer) {
    return tsv([answer.file, '-', '-', '-', '-', answer.error]);
  }
  const faults = faultsOf(answer);
  const clean = faults.evidence + faults.requirement + faults.absent === 0;
  const { hints } = answer.output;
  return tsv([
    answer.file,
    hints.length,
    faults.evidence,
    faults.requirement,
    faults.absent,
    clean ? 'ok' : 'fail',
  ]);
}

const hintLines = (hint: CvHint) => [
  `- ${hint.requirement} (до +${String(hint.expectedScoreImpact)}): ${hint.suggestion}`,
  `  CV: ${hint.evidenceInCv}`,
];

const hintedLines = ({ file, output }: Hinted) => [
  `## ${file}`,
  ...output.hints.flatMap(hintLines),
  `gaps: ${output.gaps.join('; ') || '-'}`,
  '',
];

export function cvHintsReport(answers: CvHintsCaseAnswer[]): EvalReport {
  const rows = answers.map(rowOf);
  const passed = rows.every((row) => row.endsWith('\tok'));
  const hinted = answers.filter((answer): answer is Hinted => 'output' in answer);
  return {
    lines: [
      tsv(['case', 'hints', 'evidence_not_in_cv', 'foreign_requirement', 'absent_named', 'result']),
      ...rows,
      '',
      ...hinted.flatMap(hintedLines),
      passed ? 'PASS' : 'FAIL',
    ],
    passed,
  };
}
