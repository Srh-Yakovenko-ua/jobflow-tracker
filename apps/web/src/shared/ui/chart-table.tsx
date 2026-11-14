import Link from 'next/link';

export type ChartTableCell = Readonly<{ text: string; href?: string | undefined }>;

export type ChartTableRow = Readonly<{ key: string; cells: readonly ChartTableCell[] }>;

export type ChartTableProps = Readonly<{
  caption: string;
  heads: readonly string[];
  rows: readonly ChartTableRow[];
}>;

const CELL = 'py-1 pr-4 font-normal tabular-nums';

function CellContent({ text, href }: ChartTableCell) {
  if (href === undefined) return text;
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 min-w-11 items-center text-link underline-offset-2 hover:underline active:underline"
    >
      {text}
    </Link>
  );
}

export function ChartTable({ caption, heads, rows }: ChartTableProps) {
  return (
    <div className="sr-only overflow-x-auto focus-within:not-sr-only">
      <table className="w-full text-left text-[12.5px] text-ink-2">
        <caption className="eyebrow pb-1.5 text-left text-ink-3">{caption}</caption>
        <thead>
          <tr>
            {heads.map((head) => (
              <th key={head} scope="col" className={CELL}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, column) => (
                <td key={heads[column] ?? cell.text} className={CELL}>
                  <CellContent {...cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
