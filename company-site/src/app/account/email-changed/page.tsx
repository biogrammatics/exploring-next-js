import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function EmailChangedPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const email = params.email;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-2">Email Changed Successfully</h1>
        <p className="text-gray-600 mb-4">
          Your account email has been changed to{" "}
          {email ? (
            <strong className="text-gray-800">{email}</strong>
          ) : (
            "your new email address"
          )}
          .
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-blue-800 text-sm">
            <strong>Important</strong>
            <br />
            You have been signed out for security. Please sign in again using
            your new email address.
          </p>
        </div>

        <Link
          href="/auth/signin"
          className="inline-block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Sign In with New Email
        </Link>
      </div>
    </main>
  );
}
