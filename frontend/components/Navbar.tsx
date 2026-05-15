"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Upload" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 text-lg">
            <BrainCircuit className="w-6 h-6" />
            MeetMind
          </Link>
          <div className="flex items-center gap-6">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "text-sm font-medium transition-colors",
                  pathname === href
                    ? "text-gray-900"
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
