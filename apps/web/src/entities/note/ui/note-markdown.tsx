import type { Note } from '@jobflow/shared';
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export type NoteMarkdownProps = Readonly<{ note: Pick<Note, 'body'> }>;

type MarkdownNode = Readonly<{ type: string; children?: readonly MarkdownNode[] }>;

function htmlAsText(node: MarkdownNode): MarkdownNode {
  if (node.type === 'html') {
    return { ...node, type: 'text' };
  }
  return node.children === undefined ? node : { ...node, children: node.children.map(htmlAsText) };
}

function remarkHtmlAsText() {
  return htmlAsText;
}

const NOTE_ELEMENTS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'code'];

const NOTE_PROSE =
  'flex flex-col gap-2 text-body-l text-ink wrap-anywhere [&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:whitespace-pre-line [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ps-5';

export function NoteMarkdown({ note }: NoteMarkdownProps) {
  return (
    <div className={NOTE_PROSE}>
      <Markdown
        remarkPlugins={[remarkHtmlAsText]}
        rehypePlugins={[rehypeSanitize]}
        allowedElements={NOTE_ELEMENTS}
        unwrapDisallowed
      >
        {note.body}
      </Markdown>
    </div>
  );
}
