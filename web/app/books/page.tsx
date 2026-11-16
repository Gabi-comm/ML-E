import { BOOKS } from "@/lib/books";

export default function Books() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
      <p className="label">02 · Chapter map ready · scenes not built yet</p>
      <h1 className="mt-2 font-mono text-4xl">Books</h1>
      <p className="mt-4 max-w-2xl text-lg text-white/80">
        Every chapter becomes a set of short scenes: one idea, one interactive picture, a few sentences. This is the
        map of what each chapter will show.
      </p>
      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {BOOKS.map((book) => (
          <section key={book.id}>
            <h2 className="font-mono text-xl">{book.title}</h2>
            <p className="label mt-1">{book.author} · {book.chapters.length} chapters</p>
            <ol className="mt-4 border-t border-line">
              {book.chapters.map((c) => (
                <li key={c.n} className="grid grid-cols-[2.5rem_1fr] gap-x-2 border-b border-line py-3">
                  <span className="font-mono text-sm text-dim">{String(c.n).padStart(2, "0")}</span>
                  <div>
                    <p>{c.title}</p>
                    <p className="mt-1 text-sm text-dim">{c.visual}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
