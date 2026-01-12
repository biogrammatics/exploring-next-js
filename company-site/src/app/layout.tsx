import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthSessionProvider } from "@/app/components/auth/session-provider";
import { UserMenu } from "@/app/components/auth/user-menu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Company Site",
  description: "Your company website",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthSessionProvider>
          <header className="border-b">
            <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Link href="/" className="text-xl font-bold">
                  Company
                </Link>
                <Link
                  href="/products"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Products
                </Link>
              </div>
              <UserMenu />
            </nav>
          </header>
          {children}
        </AuthSessionProvider>
      </body>
    </html>
  );
}
