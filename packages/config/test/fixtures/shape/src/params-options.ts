type MoveApplicationInput = { applicationId: string; toStage: string; reason: string };

export function moveApplication({ applicationId, toStage, reason }: MoveApplicationInput): string {
  return `${applicationId}:${toStage}:${reason}`;
}
