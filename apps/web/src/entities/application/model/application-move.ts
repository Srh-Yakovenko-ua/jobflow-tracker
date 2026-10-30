import type { ApplicationCard, RejectionReasonCode, Stage } from '@jobflow/shared';

export type MovingApplication = Pick<ApplicationCard, 'id' | 'company' | 'currentStage'>;

export type ApplicationMove = Readonly<{
  application: MovingApplication;
  toStage: Stage;
  reasonCode?: RejectionReasonCode;
}>;
