export type ChildOfApplication = { applicationId: string; id: string };

export function ownedChildWhere(userId: string, { applicationId, id }: ChildOfApplication) {
  return { id, applicationId, application: { userId, deletedAt: null } };
}
