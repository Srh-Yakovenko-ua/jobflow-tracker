export function moveApplication(applicationId: string, toStage: string, reason: string): string {
  return `${applicationId}:${toStage}:${reason}`;
}
