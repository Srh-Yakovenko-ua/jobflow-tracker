import { RESUME_MIMES, type ResumeMime } from '@jobflow/shared';

export const RESUME_SIGNATURE_BYTES = 8;

const SIGNATURES: Record<ResumeMime, readonly number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    0x50, 0x4b, 0x03, 0x04,
  ],
};

export function detectResumeFormat(start: Uint8Array): ResumeMime | null {
  const matches = (mime: ResumeMime) =>
    SIGNATURES[mime].every((byte, index) => start[index] === byte);
  return RESUME_MIMES.find(matches) ?? null;
}
