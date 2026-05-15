"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, LayoutDashboard, Upload, Search } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/search", label: "Search", icon: Search },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-200">
        <BrainCircuit className="text-gray-900" size={22} />
        <span className="text-sm font-medium text-gray-900">MeetMind</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
                isActive
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
