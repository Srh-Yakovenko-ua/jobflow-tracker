import type { Prisma } from '../generated/prisma/client.js';

export type OwnedApplication = { userId: string; applicationId: string };

export async function lockOwnedApplication(
  tx: Prisma.TransactionClient,
  { userId, applicationId }: OwnedApplication,
): Promise<boolean> {
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM applications
    WHERE id = ${applicationId}::uuid AND user_id = ${userId}::uuid AND deleted_at IS NULL
    FOR UPDATE`;
  return locked.length > 0;
}
