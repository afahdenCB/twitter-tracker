import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Follow Tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}>
      <body className="min-h-full">
        <nav className="border-b bg-card">
          <div className="max-w-6xl mx-auto px-6 flex items-center gap-8 h-14">
            <span className="font-semibold text-foreground">Follow Tracker</span>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Feed
            </Link>
            <Link href="/convergence" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Convergence
            </Link>
            <Link href="/accounts" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Accounts
            </Link>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
