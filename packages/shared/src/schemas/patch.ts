export const isNonEmptyPatch = (patch: object) => Object.keys(patch).length > 0;

export const NON_EMPTY_PATCH_ISSUE = { error: 'Send at least one field to change' };
