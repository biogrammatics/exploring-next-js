import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ email?: string; type?: string }>;
}

export default async function VerifyRequestPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const email = params.email;
  const isNewAccount = params.type === "new";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">{isNewAccount ? "🎉" : "📧"}</div>

        <h1 className="text-3xl font-bold mb-2">
          {isNewAccount ? "Almost there!" : "Check your email"}
        </h1>

        {isNewAccount ? (
          <>
            <p className="text-gray-600 mb-4">
              We&apos;ve sent a verification link to{" "}
              {email ? (
                <strong className="text-gray-800">{email}</strong>
              ) : (
                "your email address"
              )}
              .
            </p>
            <p className="text-gray-600 mb-6">
              Click the link in the email to verify your address and complete
              your account setup.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-green-800 text-sm">
                <strong>What happens next?</strong>
                <br />
                Once you click the link, your account will be created and
                you&apos;ll be signed in automatically.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              A sign-in link has been sent to{" "}
              {email ? (
                <strong className="text-gray-800">{email}</strong>
              ) : (
                "your email address"
              )}
              .
            </p>
            <p className="text-gray-600 mb-6">
              Click the link in the email to sign in to your account.
            </p>
          </>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-yellow-800 text-sm">
            <strong>Don&apos;t see the email?</strong>
            <br />
            Check your spam or junk folder. The email should arrive within a few
            minutes. If it doesn&apos;t arrive, you can request a new link.
          </p>
        </div>

        <Link
          href="/auth/signin"
          className="text-blue-600 hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
