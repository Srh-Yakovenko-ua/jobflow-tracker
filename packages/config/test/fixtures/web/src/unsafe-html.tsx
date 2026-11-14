export function UnsafeNote({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function evaluate(source: string): unknown {
  return eval(source);
}
