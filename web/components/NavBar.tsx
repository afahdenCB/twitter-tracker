"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Feed" },
  { href: "/convergence", label: "Convergence" },
  { href: "/accounts", label: "Accounts" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-card">
      <div className="max-w-6xl mx-auto px-6 flex items-center gap-8 h-14">
        <span className="font-semibold text-foreground">Follow Tracker</span>
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`text-sm transition-colors pb-[2px] ${
                active
                  ? "text-blue-500 border-b-2 border-blue-500"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
