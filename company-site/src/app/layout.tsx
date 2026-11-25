import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthSessionProvider } from "@/app/components/auth/session-provider";
import { UserMenu } from "@/app/components/auth/user-menu";
import { CartProvider } from "@/app/components/cart/cart-context";
import { CartIcon } from "@/app/components/cart/cart-icon";
import { isIndexable, SITE_NAME, siteUrl } from "@/lib/site";
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
  // Lets child pages use relative canonical URLs and relative OG images.
  metadataBase: new URL(siteUrl()),
  title: {
    // Leads with what a customer searches for rather than the company name.
    // Competitors rank on this vocabulary; "Expression in the Language of
    // Life" is a tagline, not a title.
    default: "Pichia Protein Expression CRO, Vectors & Strains | BioGrammatics",
    // Child pages set a bare title ("pGAB1") and inherit the suffix.
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Contract research in Pichia pastoris (Komagataella phaffii): custom strain development, expression feasibility studies, plus Pichia vectors and strains.",
  // Belt and braces with robots.txt while the beta is a staging copy of the
  // live Wix site. Removed automatically once SITE_INDEXABLE=true.
  robots: isIndexable() ? undefined : { index: false, follow: false },
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
                  {/*
                    "Subscriptions" linked to /subscriptions, which does not
                    exist and 404'd. The Subscription model is real but has no
                    public UI at all, so there is nothing to link to yet.

                    "Services" linked to /services, which also 404'd — from
                    the primary nav, for the business that is ~90% of revenue.
                    Pointed at the strain design request flow as the interim
                    services entry point; it becomes
                    /pichia-protein-expression-services once that page exists.
                  */}
                  <Link
                    href="/path-to-protein"
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
