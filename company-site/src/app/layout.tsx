import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthSessionProvider } from "@/app/components/auth/session-provider";
import { UserMenu } from "@/app/components/auth/user-menu";
import { CartProvider } from "@/app/components/cart/cart-context";
import { CartIcon } from "@/app/components/cart/cart-icon";
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
  title: "BioGrammatics - Pichia Protein Expression Solutions",
  description: "Superior protein expression solutions anchored by the capabilities of Pichia pastoris. Vectors, strains, and custom protein expression services.",
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
        {/* Animated gradient background */}
        <div className="gradient-bg">
          <div className="g1" />
          <div className="g2" />
          <div className="g3" />
          <div className="g4" />
          <div className="g5" />
          <div className="texture" />
        </div>
        <AuthSessionProvider>
          <CartProvider>
            <header className="glass-nav sticky top-0 z-50">
              <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <Link href="/" className="text-xl font-bold text-gray-800">
                    BioGrammatics
                  </Link>
                  <Link
                    href="/vectors"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Vectors
                  </Link>
                  <Link
                    href="/strains"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Strains
                  </Link>
                  <Link
                    href="/subscriptions"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Subscriptions
                  </Link>
                  <Link
                    href="/services"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Services
                  </Link>
                </div>
                <div className="flex items-center gap-4">
                  <CartIcon />
                  <UserMenu />
                </div>
              </nav>
            </header>
            {children}
          </CartProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
