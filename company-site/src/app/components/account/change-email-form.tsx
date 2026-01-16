"use client";

import { useState } from "react";

interface ChangeEmailFormProps {
  currentEmail: string;
}

export function ChangeEmailForm({ currentEmail }: ChangeEmailFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate emails match
    if (newEmail.toLowerCase().trim() !== confirmEmail.toLowerCase().trim()) {
      setError("Email addresses do not match");
      return;
    }

    // Validate different from current
    if (newEmail.toLowerCase().trim() === currentEmail.toLowerCase()) {
      setError("New email must be different from your current email");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to request email change");
      }

      setSuccess(
        `Verification email sent to ${newEmail}. Please check your inbox and click the link to complete the change.`
      );
      setNewEmail("");
      setConfirmEmail("");
      setIsExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request email change");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm text-gray-500">Email Address</p>
          <p className="font-medium text-gray-800">{currentEmail}</p>
        </div>
        {!isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Change Email
          </button>
        )}
      </div>

      {success && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
          {success}
        </div>
      )}

      {isExpanded && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="new-email" className="block text-sm font-medium text-gray-700 mb-1">
              New Email Address
            </label>
            <input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Enter new email"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          <div>
            <label htmlFor="confirm-new-email" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Email Address
            </label>
            <input
              id="confirm-new-email"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Re-enter new email"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !newEmail || !confirmEmail}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 text-sm font-medium"
            >
              {isSubmitting ? "Sending..." : "Send Verification Email"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setNewEmail("");
                setConfirmEmail("");
                setError("");
              }}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-gray-500">
            A verification link will be sent to your new email address. Your email won&apos;t change until you click the link.
          </p>
        </form>
      )}
    </div>
  );
}
