/** Progressive disclosure: show the top of a list, fold the rest behind a native <details>. */
export function Disclosure({ summary, children }: { summary: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="disclosure">
      <summary>{summary}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
