"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/missions", label: "Missions" },
  { href: "/heists", label: "Heists" },
  { href: "/empire", label: "Empire" },
  { href: "/character", label: "Character" },
  { href: "/stats", label: "Stats" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {LINKS.map((link) => {
        const active =
          link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`hud-label rounded px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-panel-2 text-gold"
                : "text-muted hover:text-white hover:bg-panel-2/60"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
