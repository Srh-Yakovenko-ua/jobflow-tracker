export type LogLine = Record<string, unknown>;

export function memoryLog() {
  const lines: string[] = [];
  const sink = {
    write: (line: string) => {
      lines.push(line);
    },
  };
  const parsed = () => lines.map((line) => JSON.parse(line) as LogLine);
  return { lines, sink, parsed };
}
