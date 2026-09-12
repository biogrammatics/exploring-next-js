import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

interface ErrorCopy {
  title: string;
  message: string;
  /** Label for the primary action button. */
  action: string;
  /** Where the primary action goes. */
  href: string;
}

// Codes emitted by our own routes (verify-magic-link, verify-email-change)
// plus the standard Auth.js error codes routed here via `pages.error`.
const ERROR_COPY: Record<string, ErrorCopy> = {
  InvalidToken: {
    title: "Invalid Link",
    message:
      "This link is invalid or has already been used. Links can only be used once; request a new one to continue.",
    action: "Request a new link",
    href: "/auth/signin",
  },
  TokenExpired: {
    title: "Link Expired",
    message:
      "This link has expired. For your security, links only work for a limited time. Request a new link to continue.",
    action: "Request a new link",
    href: "/auth/signin",
  },
  EmailAlreadyInUse: {
    title: "Email Already In Use",
    message:
      "That email address is already attached to another BioGrammatics account, either as its sign-in address or as a team email. Choose a different address, or have the other account release it first.",
    action: "Back to your account",
    href: "/account",
  },
  Verification: {
    title: "Verification Failed",
    message:
      "We could not verify that link. It may have expired or already been used. Request a new link to try again.",
    action: "Request a new link",
    href: "/auth/signin",
  },
  Configuration: {
    title: "Server Configuration Error",
    message:
      "There is a problem with the server configuration. Please try again later or contact support if the problem persists.",
    action: "Back to sign in",
    href: "/auth/signin",
  },
  AccessDenied: {
    title: "Access Denied",
    message: "You do not have access to this resource.",
    action: "Back to sign in",
    href: "/auth/signin",
  },
  Default: {
    title: "Authentication Error",
    message: "An error occurred during authentication. Please try again.",
    action: "Try Again",
    href: "/auth/signin",
  },
};

export default async function AuthErrorPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = params.error || "Default";
  const copy = ERROR_COPY[code] ?? ERROR_COPY.Default;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-3xl font-bold mb-2">{copy.title}</h1>
        <p className="text-gray-600 mb-6">{copy.message}</p>
        <Link
          href={copy.href}
          className="inline-block bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {copy.action}
        </Link>
      </div>
    </main>
  );
}
