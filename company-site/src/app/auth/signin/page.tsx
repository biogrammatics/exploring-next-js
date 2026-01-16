"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "email" | "confirm-new" | "sending";

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function checkEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const normalizedEmail = email.toLowerCase().trim();

      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      if (!response.ok) {
        throw new Error("Failed to check email");
      }

      const { exists } = await response.json();

      if (exists) {
        // Existing user - send magic link directly
        await sendMagicLink(normalizedEmail, false);
      } else {
        // New user - ask for confirmation
        setStep("confirm-new");
        setIsLoading(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  }

  async function handleConfirmEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedConfirm = confirmEmail.toLowerCase().trim();

    if (normalizedEmail !== normalizedConfirm) {
      setError("Email addresses do not match. Please check and try again.");
      return;
    }

    setIsLoading(true);
    await sendMagicLink(normalizedEmail, true);
  }

  async function sendMagicLink(emailAddress: string, isNewAccount: boolean) {
    setStep("sending");

    try {
      // Call our custom sign-in API that handles the magic link
      const response = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailAddress,
          isNewAccount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send email");
      }

      // Redirect to verify-request page with context
      const params = new URLSearchParams({
        email: emailAddress,
        type: isNewAccount ? "new" : "existing",
      });
      router.push(`/auth/verify-request?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email. Please try again.");
      setStep("email");
      setIsLoading(false);
    }
  }

  function goBack() {
    setStep("email");
    setConfirmEmail("");
    setError("");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {step === "email" && (
          <>
            <h1 className="text-3xl font-bold text-center mb-2">
              Sign In or Create Account
            </h1>
            <p className="text-gray-600 text-center mb-8">
              Enter your email to continue
            </p>

            <form onSubmit={checkEmail} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                {isLoading ? "Checking..." : "Continue"}
              </button>
            </form>

            <p className="text-sm text-gray-500 text-center mt-6">
              We&apos;ll send you a secure link to sign in. No password needed.
            </p>
          </>
        )}

        {step === "confirm-new" && (
          <>
            <h1 className="text-3xl font-bold text-center mb-2">
              Create New Account
            </h1>
            <p className="text-gray-600 text-center mb-8">
              We don&apos;t have an account for <strong>{email}</strong>.
              <br />
              Please confirm your email address to create one.
            </p>

            <form onSubmit={handleConfirmEmail} className="space-y-4">
              <div>
                <label htmlFor="email-display" className="block text-sm font-medium mb-1">
                  Email address
                </label>
                <input
                  id="email-display"
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label htmlFor="confirm-email" className="block text-sm font-medium mb-1">
                  Confirm email address
                </label>
                <input
                  id="confirm-email"
                  name="confirm-email"
                  type="email"
                  required
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Re-enter your email"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                {isLoading ? "Creating account..." : "Create Account & Send Link"}
              </button>

              <button
                type="button"
                onClick={goBack}
                className="w-full text-gray-600 py-2 px-4 rounded-lg hover:bg-gray-100 transition-colors"
              >
                &larr; Use a different email
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Why confirm?</strong> This ensures your account is created
                with the correct email address. You&apos;ll receive a verification
                link to complete setup.
              </p>
            </div>
          </>
        )}

        {step === "sending" && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold mb-2">Sending your link...</h1>
            <p className="text-gray-600">Please wait a moment.</p>
          </div>
        )}
      </div>
    </main>
  );
}
