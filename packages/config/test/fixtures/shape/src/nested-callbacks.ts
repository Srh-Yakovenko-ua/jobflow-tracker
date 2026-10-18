export function incrementAll(groups: number[][][][]): number[] {
  return groups.flatMap((a) => a.flatMap((b) => b.flatMap((c) => c.map((d) => d + 1))));
}
