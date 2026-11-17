import { Fragment } from "react";

/** Inline `code` inside a line of text. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
          <code key={i} className="border border-line bg-black px-1 font-mono text-[0.92em] text-pos">{part.slice(1, -1)}</code>
        ) : part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
        ) : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <em key={i}>{part.slice(1, -1)}</em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * A small, safe Markdown subset: paragraphs, `inline code`, **bold**, ``` code blocks ``` and - lists.
 * Everything is rendered as text, never as HTML.
 */
export default function Rich({ text, className = "" }: { text: string; className?: string }) {
  const blocks = text.split(/```[a-zA-Z]*\n?/);
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {blocks.map((block, i) => {
        if (i % 2 === 1) {
          return (
            <pre key={i} className="overflow-x-auto border border-line bg-black p-2 font-mono text-xs leading-relaxed text-white/90">
              {block.replace(/\n$/, "")}
            </pre>
          );
        }
        return block
          .split(/\n{2,}/)
          .map((para) => para.trim())
          .filter(Boolean)
          .map((para, j) => {
            const lines = para.split("\n");
            if (lines.every((line) => /^\s*([-*]|\d+\.)\s/.test(line))) {
              return (
                <ul key={`${i}-${j}`} className="flex flex-col gap-1 pl-4">
                  {lines.map((line, k) => (
                    <li key={k} className="list-disc"><Inline text={line.replace(/^\s*([-*]|\d+\.)\s/, "")} /></li>
                  ))}
                </ul>
              );
            }
            return <p key={`${i}-${j}`}>{lines.map((line, k) => <Fragment key={k}>{k > 0 && <br />}<Inline text={line} /></Fragment>)}</p>;
          });
      })}
    </div>
  );
}
