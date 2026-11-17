import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ChapterPlayer from "@/components/scenes/ChapterPlayer";
import { BOOKS, BUILT } from "@/lib/books";

export function generateStaticParams() {
  return BOOKS.flatMap((book) => book.chapters.map((c) => ({ book: book.id, chapter: String(c.n) })));
}

export default function Chapter({ params }: PageProps<"/books/[book]/[chapter]">) {
  return (
    <Suspense fallback={<p className="label p-8">Loading chapter…</p>}>
      <ChapterBody params={params} />
    </Suspense>
  );
}

async function ChapterBody({ params }: { params: Promise<{ book: string; chapter: string }> }) {
  const { book: bookId, chapter: number } = await params;
  const book = BOOKS.find((b) => b.id === bookId);
  const chapter = book?.chapters.find((c) => String(c.n) === number);
  if (!book || !chapter) notFound();
  const index = book.chapters.indexOf(chapter);
  const key = `${book.id}-${chapter.n}`;

  if (!BUILT.has(key)) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
        <Link href="/books" className="label hover:text-white">◂ Books</Link>
        <p className="label mt-6">{book.title} · Chapter {chapter.n} · scenes not built yet</p>
        <h1 className="mt-2 font-mono text-3xl">{chapter.title}</h1>
        <p className="mt-4 text-lg text-white/80">Planned visual: {chapter.visual}.</p>
      </div>
    );
  }

  return (
    <ChapterPlayer
      chapterKey={key}
      bookTitle={book.title}
      chapterNumber={chapter.n}
      chapterTitle={chapter.title}
      next={book.chapters.slice(index + 1).find((c) => BUILT.has(`${book.id}-${c.n}`))?.n ?? null}
      bookId={book.id}
    />
  );
}
