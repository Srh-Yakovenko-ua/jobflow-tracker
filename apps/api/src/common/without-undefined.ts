export type WithoutUndefined<T> = { [Key in keyof T]: Exclude<T[Key], undefined> };

export function withoutUndefined<T extends object>(value: T): WithoutUndefined<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as WithoutUndefined<T>;
}
