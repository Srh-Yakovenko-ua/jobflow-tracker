import { uk } from '@/shared/i18n';

export type ParsingStatusProps = Readonly<{ count: number }>;

export function ParsingStatus({ count }: ParsingStatusProps) {
  return (
    <p role="status" className="sr-only">
      {count > 0 && uk.board.parsing(count)}
    </p>
  );
}
