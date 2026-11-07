import type { ResumeMime } from '@jobflow/shared';

export type ResumeObjectRef = { userId: string; uploadId: string; mime: ResumeMime };

const EXTENSIONS: Record<ResumeMime, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export const PENDING_RESUME_PREFIX = 'pending/';

export const resumeStorageKey = ({ userId, uploadId, mime }: ResumeObjectRef) =>
  `users/${userId}/resumes/${uploadId}.${EXTENSIONS[mime]}`;

export const pendingResumeKey = (ref: ResumeObjectRef) =>
  `${PENDING_RESUME_PREFIX}${resumeStorageKey(ref)}`;
