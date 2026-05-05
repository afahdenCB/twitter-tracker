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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-gray-50">
        <nav className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-6 flex items-center gap-8 h-14">
            <span className="font-semibold text-gray-900">Follow Tracker</span>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Dashboard
            </Link>
            <Link href="/convergence" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Convergence
            </Link>
            <Link href="/feed" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Feed
            </Link>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
