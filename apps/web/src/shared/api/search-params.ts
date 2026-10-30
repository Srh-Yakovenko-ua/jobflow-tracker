export type SearchParamValue = string | number | boolean | readonly string[] | undefined;

export type SearchParams = Readonly<Record<string, SearchParamValue>>;

function formatParam(value: Exclude<SearchParamValue, undefined>): string {
  return typeof value === 'object' ? value.join(',') : String(value);
}

export function withSearchParams(path: string, params: SearchParams): string {
  const entries = Object.entries(params).flatMap(([key, value]) =>
    value === undefined ? [] : [[key, formatParam(value)]],
  );
  return entries.length === 0 ? path : `${path}?${new URLSearchParams(entries).toString()}`;
}
