import Link from "next/link";
import BloomHero from "@/components/BloomHero";

const SECTIONS = [
  { href: "/books", n: "02", name: "Books", text: "Both books, chapter by chapter, as short interactive scenes instead of pages.", status: "29 chapters · 103 scenes" },
  { href: "/lab", n: "03", name: "Lab", text: "Write Python on the left. Watch the network, loss and outputs appear on the right.", status: "Working" },
  { href: "/projects", n: "04", name: "Projects", text: "Bring your own images or CSV, build a model, train it here or export it for Kaggle's GPU.", status: "Working" },
  { href: "/analytics", n: "05", name: "Analytics", text: "Upload a trained model and see where it is right, wrong and why.", status: "Working" },
];

const STEPS = [
  { k: "See", text: "Open a chapter. One idea per scene, one picture you can move." },
  { k: "Type", text: "Open the same idea in the Lab. Each layer you write appears in 3D." },
  { k: "Build", text: "Use your own data and train a model you can export." },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      <section className="relative flex min-h-[calc(100dvh-3rem)] items-end overflow-hidden border-b border-line">
        <BloomHero className="absolute inset-0 h-full w-full" />
        <div className="relative w-full bg-gradient-to-t from-black via-black/85 to-transparent px-4 pb-10 pt-32 sm:px-10">
          <p className="label mb-3">01 · Machine learning, engineered to be seen</p>
          <h1 className="font-mono text-6xl font-semibold tracking-[0.12em] sm:text-8xl">ML-E</h1>
          <p className="mt-4 max-w-xl text-lg text-white/80">
            A studio for learning machine learning and AI engineering by watching it work. Less reading, more
            seeing: every idea is a scene, every line of code is a picture.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/lab" className="btn btn-solid">Open the Lab</Link>
            <Link href="/books" className="btn">Browse the books</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-px border-b border-line bg-line sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.k} className="bg-black p-6 sm:p-8">
            <p className="label">Step {i + 1}</p>
            <h2 className="mt-2 font-mono text-2xl">{step.k}</h2>
            <p className="mt-2 text-white/70">{step.text}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-px bg-line sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group bg-black p-6 hover:bg-white hover:text-black sm:p-8">
            <p className="label group-hover:text-black/60">{s.n}</p>
            <h2 className="mt-2 font-mono text-2xl">{s.name}</h2>
            <p className="mt-2 max-w-md text-white/70 group-hover:text-black/70">{s.text}</p>
            <p className="label mt-4 group-hover:text-black/60">{s.status}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
