import { applicationStage } from '@/entities/application';

export function sharedStage(): string {
  return applicationStage();
}
