import type { Note } from '@jobflow/shared';
import Markdown, { type Options } from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

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

function keepingOnly(tagNames: string[]): Options {
  return {
    remarkPlugins: [remarkHtmlAsText],
    rehypePlugins: [[rehypeSanitize, { ...defaultSchema, tagNames }]],
  };
}

const AS_NOTE = keepingOnly(['p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'code']);

const AS_TEXT = keepingOnly([]);

const NOTE_PROSE =
  'flex flex-col gap-2 text-body-l text-ink wrap-anywhere [&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-1 [&_ol]:list-decimal [&_ol]:ps-5 [&_p]:whitespace-pre-line [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ps-5';

export function NoteMarkdown({ note }: NoteMarkdownProps) {
  return (
    <div className={NOTE_PROSE}>
      <Markdown {...AS_NOTE}>{note.body}</Markdown>
    </div>
  );
}

export function NotePlainText({ note }: NoteMarkdownProps) {
  return <Markdown {...AS_TEXT}>{note.body}</Markdown>;
}
