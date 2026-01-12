import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">📧</div>
        <h1 className="text-3xl font-bold mb-2">Check your email</h1>
        <p className="text-gray-600 mb-6">
          A sign-in link has been sent to your email address.
          Click the link in the email to sign in.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          If you don&apos;t see the email, check your spam folder.
        </p>
        <Link
          href="/auth/signin"
          className="text-blue-600 hover:underline"
        >
          Try a different email
        </Link>
      </div>
    </main>
  );
}
