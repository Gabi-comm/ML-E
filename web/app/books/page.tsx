import Link from "next/link";
import { BOOKS, BUILT } from "@/lib/books";

export default function Books() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
      <p className="label">02 · {BUILT.size} of 29 chapters have scenes</p>
      <h1 className="mt-2 font-mono text-4xl">Books</h1>
      <p className="mt-4 max-w-2xl text-lg text-white/80">
        Every chapter becomes a set of short scenes: one idea, one interactive picture, a few sentences. Chapters
        marked Open are ready; the rest show what they will cover.
      </p>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {BOOKS.map((book) => (
          <section key={book.id}>
            <h2 className="font-mono text-xl">{book.title}</h2>
            <p className="label mt-1">{book.author} · {book.chapters.length} chapters</p>
            <ol className="mt-4 border-t border-line">
              {book.chapters.map((c) => {
                const built = BUILT.has(`${book.id}-${c.n}`);
                const row = (
                  <>
                    <span className="font-mono text-sm text-dim group-hover:text-black/60">{String(c.n).padStart(2, "0")}</span>
                    <div>
                      <p className={built ? "" : "text-white/60"}>{c.title}</p>
                      <p className="mt-1 text-sm text-dim group-hover:text-black/60">{c.visual}</p>
                    </div>
                    <span className={`label self-center ${built ? "text-pos group-hover:text-black" : ""}`}>{built ? "Open ▸" : "Soon"}</span>
                  </>
                );
                return (
                  <li key={c.n} className="border-b border-line">
                    {built ? (
                      <Link href={`/books/${book.id}/${c.n}`} className="group grid grid-cols-[2.5rem_1fr_auto] gap-x-2 px-1 py-3 hover:bg-white hover:text-black">
                        {row}
                      </Link>
                    ) : (
                      <div className="grid grid-cols-[2.5rem_1fr_auto] gap-x-2 px-1 py-3">{row}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
