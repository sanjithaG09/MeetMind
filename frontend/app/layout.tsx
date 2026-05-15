import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetMind — AI Meeting Intelligence",
  description: "Turn meeting recordings into decisions, action items, and resolutions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
