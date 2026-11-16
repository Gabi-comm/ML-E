export default function Upcoming({ n, title, lead, items }: { n: string; title: string; lead: string; items: string[] }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-8">
      <p className="label">{n} · Not built yet</p>
      <h1 className="mt-2 font-mono text-4xl">{title}</h1>
      <p className="mt-4 text-lg text-white/80">{lead}</p>
      <ul className="mt-8 border-t border-line">
        {items.map((item) => (
          <li key={item} className="flex gap-3 border-b border-line py-3 text-white/80">
            <span className="px mt-2 shrink-0 opacity-50" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
