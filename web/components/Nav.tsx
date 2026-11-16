"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/books", label: "Books" },
  { href: "/lab", label: "Lab" },
  { href: "/projects", label: "Projects" },
  { href: "/analytics", label: "Analytics" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 h-12 shrink-0 border-b border-line bg-black">
      <nav className="flex h-full items-center gap-4 px-4" aria-label="Sections">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm font-semibold tracking-[0.2em]">
          <span className="grid grid-cols-2 gap-[2px]" aria-hidden>
            <span className="px" />
            <span className="px opacity-40" />
            <span className="px opacity-40" />
            <span className="px" />
          </span>
          ML-E
        </Link>
        <ul className="flex h-full min-w-0 flex-1 items-stretch overflow-x-auto">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <li key={link.href} className="flex">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center px-3 font-mono text-xs uppercase tracking-[0.12em] ${
                    active ? "bg-white text-black" : "text-dim hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
