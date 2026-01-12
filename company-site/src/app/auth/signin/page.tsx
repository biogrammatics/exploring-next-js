import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function SignInPage() {
  async function handleSignIn(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    await signIn("resend", { email, redirectTo: "/account" });
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-2">Sign In</h1>
        <p className="text-gray-600 text-center mb-8">
          Enter your email to receive a magic link
        </p>

        <form action={handleSignIn} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@company.com"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Send Magic Link
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          We&apos;ll send you a link to sign in. No password needed.
        </p>
      </div>
    </main>
  );
}
